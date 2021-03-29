# cbor-wasm

[CBOR](https://cbor.io/) decoder with the hard bits in WASM, and the JS-specific parts in JS.

## Installation

I'll release this eventually.  Until then:

`npm install github:hildjj/cbor-wasm#main`

## Required node version

For now, use a modern browser or Node 15.  Node 14 will work with
`--experimental-wasm-bigint`.  See
[issue](https://github.com/hildjj/cbor-wasm/issues/2).

## Design

Inspired by [expat](https://libexpat.github.io/), I wanted to be able to feed
bytes to a CBOR parser and have a callback called *synchronously* with all of
the events relevant to that chunk of data while that parse function is
executing.  This approach will allow both streaming as well as parsing whole
CBOR elements without async overhead.

The events describe the edges of the CBOR structure, beginnings and endings.
For bytes and strings, you will get multiple chunks when those types are
spread across chunks.

In JS, we receive those events, then create JS objects that correspond to the events.

## Events

The event method has this signature in C:

```C
void event(int type, int bytes, Phase phase, int line)
```

- `type` the Major Type of the event, or FAIL
- `bytes` depending on phase:
  - BEGIN(0) phase: the number of additional bytes in the major type argument (0, 1, 2, 4, 8)
  - BETWEEN_ITEMS(1) phase: the total number of (bytes or items) expected, or -1 for streaming
  - AFTER_ITEM(2) phase: the total number of (bytes or items) expected, or -1 for streaming
  - FINISH(3) phase:
    - MT 0,1,7: the number of additional bytes in the major type argument (0, 1, 2, 4, 8)
    - MT 2,3,4,5: -1, or 0x1f if streaming
    - MT 6: -1
  - ERROR(4) phase: the count of bytes into the input chunk where the error occurred
- `phase` which phase of an item are we in?
  - BEGIN(0): a container item is beginning.  Total number of items or bytes expected is in `parser->last_val`
  - BETWEEN_ITEMS(1): In a collection, we are between items, in the place that a comma
    or colon would need to go
  - AFTER_ITEM(2): you have received all of the events for item N in a container.  N is in `parser->last_val`
  - FINISH(3): a full item has been receieved.  For containers, the total number of contained items (including BREAKs) is in `parser->last_val`.  For MT 0,1,7, the value is in `parser->last_val`.
  - ERROR(4): an error occurred.  Line number from library.c is in `parser->last_val`
- `line`: line number in `library.c` where the event was fired.  Useful for
  debugging, but I'll probably remove it in production builds later.

The parser structure is exposed in the library.h file, but the important thing
is that `parser->last_val` is the first 8 bytes of the structure, and is
unsigned.

## API

For the WASM portions:

```C
// MUST be supplied by caller in the WASM environment
extern void event(int type, int bytes, Phase phase, int line);
typedef struct Parser Parser;
extern const int PARSER_SIZE;
extern const int MAX_DEPTH;  // currently 20
extern const int FAIL;       // currently -128

// Always call init_parser first
void init_parser(Parser *parser);
int parse(Parser *parser, unsigned char *start, int len);
```

Note that the WASM code is completely `-nostdlib`, it doesn't call `malloc`,
so you'll need to be careful about your own memory management in the caller.
`__heap_base` and `PARSER_SIZE` will be useful to you.  See
[cbor.mjs](https://github.com/hildjj/cbor-wasm/blob/c0f702f0c02d0f695ac5a7406023a786b91c0c39/lib/cbor.mjs#L137)
for ideas.

For JS:
```js
import {Decoder, Tag, Simple} from 'cbor-wasm'
const d = new Decoder((er, obj) => {})
await d.init()
d.write(Uint8Array, ?start, ?end)
```

The function passed in to the Decoder constructor will get called once per
top-level CBOR object in your input.

## Development

You'll need a late-model version of clang from [llvm](https://llvm.org/).  I'm using version 11.1.0, which I installed with:

```sh
brew install llvm
echo 'export PATH="/usr/local/opt/llvm/bin:$PATH"' >> ~/.zshrc
```

Make sure to check out the git submodules, which have the test vectors in them:

```sh
git submodule update --init
```

Then:

```sh
npm install
npm test
```

To run in the web:

```sh
npm start
```

There's a native (non-WASM) version of the C code also compiled as `src/cbor-cli` in order to debug.  Debugging WASM code doesn't really work in any of the ways that it is supposed to yet.

## Performance

TODO: test performance against
[node-cbor](https://github.com/hildjj/node-cbor/).  My hypothesis is that this
should be much faster.  See [issue](https://github.com/hildjj/cbor-wasm/issues/2).

[![Tests](https://github.com/hildjj/cbor-wasm/actions/workflows/node.js.yml/badge.svg)](https://github.com/hildjj/cbor-wasm/actions/workflows/node.js.yml)
[![Coverage Status](https://coveralls.io/repos/github/hildjj/cbor-wasm/badge.svg?branch=main)](https://coveralls.io/github/hildjj/cbor-wasm?branch=main)
