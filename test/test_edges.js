import {Runner} from './utils.js'
import {Decoder, Diagnose} from '../lib/cbor.js'
import assert from 'assert'

const BUA = globalThis.BigUint64Array
delete globalThis.BigUint64Array
const NONE = Symbol('NONE')

async function main() {
  const runner = new Runner()

  const d = new Decoder()
  await d.init()

  runner.run(() => {
    runner.run(() => {
      // console.log's
      d.write('00')
    }, '00')
  })

  let res = null
  const e = new Decoder((er, x) => {
    if (er) {
      throw er
    }
    res = x
  })
  await e.init()
  e.write('6161')
  assert.deepEqual(res, 'a', '6161')

  const f = new Decoder({verbose: true})
  await f.init()
  // console.log + verbose
  f.write('8180')

  let der = NONE
  let dx = ''
  const diag = new Diagnose({
    callback(er, x) {
      if (er) {
        der = er
      } else {
        dx += x
      }
    },
    verbose: true
  })
  await diag.init()
  for (const [hex, expected] of [
    ['818120', '[[-1]]'],
    ['1b0020000000000000', '9007199254740992'],
    ['3b0020000000000000', '-9007199254740993'],
    ['7fff', '(_ )'],
    ['7f6162ff', '(_ "b")'],
    ['7f6162626364ff', '(_ "b", "cd")'],
    ['9fff', '[_ ]'],
    ['9f00ff', '[_ 0]'],
    ['9f009fffff', '[_ 0, [_ ]]'],
    ['bfff', '{_ }'],
    ['bf009fffff', '{_ 0: [_ ]}'],
    ['f4', 'false'],
    ['f5', 'true'],
    ['f6', 'null'],
    ['f98000', '-0_1']
  ]) {
    // eslint-disable-next-line no-loop-func
    runner.run(() => {
      dx = ''
      diag.write(hex)
      assert.deepEqual(der, NONE, hex)
      assert.deepEqual(dx, expected, hex)
    })
  }
  runner.run(() => {
    dx = ''
    diag.write('ff')
    assert(der instanceof Error, 'ff')
    assert.deepEqual(dx, '', 'ff')
  })

  runner.summary()
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(e => {
    globalThis.BigUint64Array = BUA
  })
