import {Decoder, Tag} from '../lib/cbor.mjs'
import assert from 'assert'
import util from 'util'

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
  ['c3491c0000000000000000', new Tag(3, Decoder.hex('1c0000000000000000'))],
  ['fb3ff3333333333333', 1.2],
  ['fbbff3333333333333', -1.2],
  ['fb7ff8000000000000', NaN],
  ['fb7ff0000000000000', Infinity],
  ['fbfff0000000000000', -Infinity],
  ['fb8000000000000000', -0],
  ['7f657374726561ff', 'strea'],
  ['9f00ff', [0]]
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

  function parse(str) {
    res = NONE
    d.write(str)
    if (res === NONE) {
      throw new Error(`DID NOT FINISH: "${str}"`)
    }
    // make sure we don't have to call reset() after every item.
    // this is a hack to look at the current parser state.  it must
    // be checked after write() returns, when you know a single complete
    // item has been written.
    const pbuf = new Int32Array(d.mod.memory.buffer, d.parser, 8)
    assert.equal(pbuf[0], 8) // START
    assert.equal(pbuf[1], 0)

    return res
  }

  let ok = 0
  let notOk = 0
  for (const [actual, expected] of cases) {
    try {
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
  console.log(`
${notOk}..${cases.length}
# tests ${cases.length}
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
