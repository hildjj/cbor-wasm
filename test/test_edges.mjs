import {Runner} from './utils.mjs'
import {Decoder} from '../lib/cbor.mjs'
import assert from 'assert'

const BUA = globalThis.BigUint64Array
delete globalThis.BigUint64Array

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
