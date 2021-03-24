# cbor-wasm

[CBOR](https://cbor.io/) decoder with the hard bits in WASM, and the JS-specific parts in JS.

## Installation

I'll release this eventually.  Until then:

`npm install github:hildjj/cbor-wasm#main`

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
void event(int type, int bytes, int64_t value, int line)
```

- `type` One of:
  - On start: the CBOR Major Type of the event
  - On more-data: negative of the Major Type, with a value not -1n
  - On end: negative of the Major Type, with a value of -1n
  - `FAIL` (-128) on errors
- `bytes` depending on Major Type:
  - Positive `type`s: the number of additional bytes in the major type argument
  (0, 1, 2, 4, 8)
  - -2, -3, -4, -5: the total number of (bytes or items) expected, or -1 for streaming
  - -6: always 1
  - Errors: the count of bytes into the input chunk where the error occurred
- `value`: the associated value
  - Bytes and strings: the number of bytes from the beginning of the input chunk where the data starts
  - Arrays and maps: the index of the item in the array
  - Errors: the line number in library.c that threw the error
  - All others: the value itself
  - On final end of the item, -1n
- `line`: line number in `library.c` where the event was fired.  Useful for debugging, but I'll probably remove it in production builds later.

## API

For the WASM portions:

```C
// MUST be supplied by caller in the WASM environment
extern void event(int type, int bytes, int64_t value, int line);
struct Parser;
typedef struct Parser Parser;
extern const int PARSER_SIZE;
extern const int MAX_DEPTH;  // currently 20
extern const int FAIL;       // currently 128

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
