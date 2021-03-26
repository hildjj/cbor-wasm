import {TestParser, Runner} from './utils.mjs'
import {Decoder, Tag} from '../lib/cbor.mjs'
import assert from 'assert'

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
  ['fb3ff0000000000000', 1],
  ['fb3ff0000000000001', 1 + Math.pow(2, -52)],
  ['fb4000000000000000', 2],
  ['fb0000000000000001', Math.pow(2, -1074)],
  ['fb0000000000000000', 0],
  ['fb8000000000000000', -0],
  ['fb7ff8000000000000', NaN],
  ['fb7ff0000000000000', Infinity],
  ['fbfff0000000000000', -Infinity],
  ['7f657374726561ff', 'strea'],
  ['9f00ff', [0]],
  ['5fff', new Uint8Array(0)],
  ['5f41004101ff', new Uint8Array([0, 1])],
  ['bf00010203ff', new Map([[0, 1], [2, 3]])],
  ['f6', null]
]

async function main() {
  const parser = new TestParser()
  await parser.init()
  const runner = new Runner()
  for (const [actual, expected] of cases) {
    runner.run(() => {
      const parsed = parser.parse(actual)
      // Node 12
      if (Object.is(expected, NaN)) {
        assert(Object.is(parsed, NaN), actual)
      } else {
        assert.deepEqual(parsed, expected, actual)
      }
    }, actual)
  }
  runner.summary()
}

main().catch(console.error)
