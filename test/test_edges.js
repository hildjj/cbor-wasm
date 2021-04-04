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
    // console.log's
    d.write('00')
  }, '00')

  let res = NONE
  const e = new Decoder((er, x) => {
    if (er) {
      throw er
    }
    res = x
  })
  await e.init()
  runner.run(() => {
    res = NONE
    e.write('6161')
    assert.deepEqual(res, 'a', '6161')
  }, 'function param')
  runner.run(() => {
    res = NONE
    e.writeBuffer[10] = 0x81
    e.writeBuffer[11] = 0x80
    e.write(null, 10, 12)
    assert.deepEqual(res, [[]], '8180')
  }, 'direct writeBuffer usage')
  runner.run(() => {
    res = NONE
    e.writeBuffer[1] = 0x00
    e.write('81')
    assert.deepEqual(res, NONE)
  }, 'Ensure do not read past end')
  runner.run(() => {
    res = NONE
    e.reset()
    assert.throws(() => e.write())
  }, 'Throws on null buffer and end')

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
    verbose: false
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
    }, hex)
  }
  runner.run(() => {
    dx = ''
    diag.opts.verbose = true
    diag.write('ff')
    assert(der instanceof Error, 'ff')
    assert.deepEqual(dx, '', 'ff')
  }, 'ff')

  const sd = await Decoder.decoder()
  runner.run(() => {
    assert.deepEqual(sd('00'), 0, 'static 00')
    assert.throws(() => sd('81'))
    assert.throws(() => sd('ff'))

    const bigsz = 2 * d.max
    const big = new Uint8Array(bigsz + 5)
    big[0] = 0x5a
    const dv = new DataView(big.buffer)
    dv.setUint32(1, bigsz, false)
    assert.deepEqual(sd(big).length, bigsz, 'big')
  }, 'static decode')

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
