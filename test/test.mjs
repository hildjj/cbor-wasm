import {Decoder, Tag} from '../lib/cbor.mjs'
import assert from 'assert'
import util from 'util'
import fs from 'fs'

const cases = [
  ['00', 0],
  ['01', 1],
  ['1818', 24],
  ['20', -1],
  ['60', ''],
  ['6161', 'a'],
  ['80', []],
  ['8100', [0]],
  ['820001', [0, 1]],
  ['8200820102', [0, [1, 2]]],
  ['6461626364', 'abcd'],
  ['a0', {}],
  ['a161616461626364', {a: 'abcd'}],
  ['a16461626364a1616100', {abcd: {a: 0}}],
  ['a16461626364820001', {abcd: [0, 1]}],
  ['491c0000000000000000', Decoder.hex('1c0000000000000000')],
  ['81491c0000000000000000', [Decoder.hex('1c0000000000000000')]],
  ['c9491c0000000000000000', new Tag(9, Decoder.hex('1c0000000000000000'))],
  ['fb3ff3333333333333', 1.2],
  ['fbbff3333333333333', -1.2],
  ['fb7ff8000000000000', NaN],
  ['fb7ff0000000000000', Infinity],
  ['fbfff0000000000000', -Infinity],
  ['fb8000000000000000', -0],
  ['7f657374726561ff', 'strea'],
  ['9f00ff', [0]],
  ['5fff', new Uint8Array(0)],
  ['5f41004101ff', new Uint8Array([0, 1])],
  ['bf00010203ff', new Map([[0, 1], [2, 3]])],
  ['f6', null]
]
const NONE = Symbol('NONE')

async function main() {
  let res = NONE
  const d = new Decoder({
    callback(er, x) {
      if (er) {
        throw er
      } else {
        res = x
      }
    },
    verbose: false
  })
  await d.init()

  // this is a hack to look at the current parser state.  it must
  // be checked after write() returns, when you know a single complete
  // item has been written.
  const parser_state = new Int32Array(d.mod.memory.buffer, d.parser, 8)

  function parse(str) {
    res = NONE
    d.write(str)
    if (res === NONE) {
      throw new Error(`DID NOT FINISH: "${str}"`)
    }
    // make sure we don't have to call reset() after every item.
    assert.equal(parser_state[0], 8) // START
    assert.equal(parser_state[1], 0)

    return res
  }

  let ok = 0
  let notOk = 0
  let total = 0
  for (const [actual, expected] of cases) {
    try {
      total++
      assert.deepEqual(parse(actual), expected, actual)
      console.log(`ok ${ok++} ${actual}`)
    } catch (e) {
      console.log(`not ok ${notOk++} ${actual}
  ---
    ${util.inspect(e).replace(/\n/g, '\n    ')}
  ...
      `)
      d.reset()
    }
  }

  const appendix_a = new URL('../test-vectors/appendix_a.json', import.meta.url)
  let vectors = []
  try {
    let txt = await fs.promises.readFile(appendix_a, 'utf8')
    // HACK: don't lose data when JSON parsing
    txt = txt.replace(/"decoded":\s*(-?\d+(\.\d+)?(e[+-]\d+)?)\n/g,
      `"decoded": {
        "___TYPE___": "number",
        "___VALUE___": "$1"
      }
  `)
    vectors = JSON.parse(txt, (key, value) => {
      if (!value) {
        return value
      }
      switch (value['___TYPE___']) {
        case 'number': {
          const v = value['___VALUE___']
          if (/^-?\d+$/.test(v)) {
            const b = BigInt(v)
            if (b > 0) {
              return (b <= Number.MAX_SAFE_INTEGER) ? Number(b) : b
            }
            return (b >= Number.MIN_SAFE_INTEGER) ? Number(b) : b
          }
          return Number.parseFloat(v)
        }
        default:
          return value
      }
    })
  } catch (e) {
    console.log(`not ok ${notOk++}
  ---
    Run "git submodule update --init"
    ${util.inspect(e).replace(/\n/g, '\n    ')}
  ...
      `)
  }
  for (const {hex, decoded, diagnostic} of vectors) {
    try {
      total++
      let skip = true
      if (decoded != null) {
        skip = false
        assert.deepEqual(
          parse(hex),
          decoded,
          hex
        )
      }
      if ((diagnostic != null) && (![
        // real diagnose
        'c074323031332d30332d32315432303a30343a30305a',
        'd74401020304',
        'd818456449455446',
        'd82076687474703a2f2f7777772e6578616d706c652e636f6d',
        '40',
        '4401020304',
        'a201020304',
        '5f42010243030405ff'
      ].includes(hex))) {
        skip = false
        assert.deepEqual(
          util.inspect(parse(hex), {colors: false, depth: Infinity}),
          diagnostic,
          hex
        )
      }
      console.log(`${skip ? 'skip' : 'ok'} ${ok++} ${hex}`)
    } catch (e) {
      console.log(`not ok ${notOk++} ${hex}
  ---
    ${util.inspect(e).replace(/\n/g, '\n    ')}
  ...
      `)
      d.reset()
    }
  }
  console.log(`
${notOk}..${total}
# tests ${total}
# pass: ${ok}
# fail: ${notOk}
`)
  if (notOk > 0) {
    process.exit(1)
  }
}

main().catch(e => {
  process.exit(1)
})
