import {TestParser, Runner} from './utils.js'
import {Tag} from '../lib/cbor-wasm.js'
import {fromHex} from '../lib/utils.js'

import assert from 'assert'

function is(parsed, expected, actual) {
  assert(Object.is(parsed, expected), actual)
}

function near(parsed, expected, actual) {
  // see: https://floating-point-gui.de/errors/comparison/
  const absP = Math.abs(parsed)
  const absE = Math.abs(expected)
  const diff = Math.abs(parsed - expected)

  assert(
    (parsed === expected) ||
    ((absP + absE < Number.EPSILON) && (diff < Number.EPSILON)) ||
    (diff / Math.min(absP + absE, Number.MAX_VALUE) < 1e-8),
    actual
  )
}

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
  ['491c0000000000000000', fromHex('1c0000000000000000')],
  ['81491c0000000000000000', [fromHex('1c0000000000000000')]],
  ['c9491c0000000000000000', new Tag(9, fromHex('1c0000000000000000'))],
  ['fb3ff3333333333333', 1.2],
  ['fbbff3333333333333', -1.2],
  ['fb3ff0000000000000', 1],
  ['fb3ff0000000000001', 1 + Math.pow(2, -52)],
  ['fb4000000000000000', 2],
  ['fb0000000000000001', Math.pow(2, -1074)],
  ['fb0000000000000000', 0],
  ['fb8000000000000000', -0],
  ['fb7ff8000000000000', NaN, is],
  ['fb7ff0000000000000', Infinity],
  ['fbfff0000000000000', -Infinity],
  ['7f657374726561ff', 'strea'],
  ['9f00ff', [0]],
  ['5fff', new Uint8Array(0)],
  ['5f41004101ff', new Uint8Array([0, 1])],
  ['bf00010203ff', new Map([[0, 1], [2, 3]])],
  ['f6', null],
  ['f90000', 0],
  ['f98000', -0],
  ['f97c00', Infinity],
  ['f9fc00', -Infinity],
  ['f97e00', NaN, is],
  ['f90001', 0.000000059604645, near],
  ['f903ff', 0.000060975552, near],
  ['f90400', 0.00006103515625],
  ['f97bff', 65504],
  ['f93bff', 0.99951172, near],
  ['f93c00', 1],
  ['f93c01', 1.00097656, near],
  ['f93555', 0.33325195, near],
  ['f9c000', -2]
]

function main() {
  const parser = new TestParser()
  const runner = new Runner()
  for (const [actual, expected, predicate] of cases) {
    runner.run(() => {
      const parsed = parser.parse(actual)
      if (predicate) {
        predicate(parsed, expected, actual)
      } else {
        assert.deepEqual(parsed, expected, actual)
      }
    }, actual)
  }
  runner.summary()
}

main()
