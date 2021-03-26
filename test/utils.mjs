import assert from 'assert'
import {Decoder} from '../lib/cbor.mjs'
import util from 'util'

export const NONE = Symbol('NONE')

export class TestParser {
  constructor() {
    this.result = NONE
    const that = this
    this.decoder = new Decoder({
      callback(er, x) {
        if (er) {
          throw er
        } else {
          that.result = x
        }
      },
      verbose: false
    })
  }

  async init() {
    await this.decoder.init()

    // this is a hack to look at the current parser state.  it must
    // be checked after write() returns, when you know a single complete
    // item has been written.
    this.parser_state = new Int32Array(
      this.decoder.mod.memory.buffer,
      this.decoder.parser + 8,
      2
    )
  }

  parse(str) {
    this.result = NONE
    const sz = this.decoder.write(str)
    if (this.result === NONE) {
      throw new Error(`DID NOT FINISH: "${str}"`)
    }
    if (sz !== (str.length / 2)) {
      throw new Error('Unused data')
    }
    // make sure we don't have to call reset() after every item.
    assert.equal(this.parser_state[0], 8) // START
    assert.equal(this.parser_state[1], 0)

    return this.result
  }

  parse_fail(str) {
    try {
      this.result = NONE
      const sz = this.decoder.write(str)
      if (sz !== (str.length / 2)) {
        return true
      }
      if (this.result !== NONE) {
        return false
      }
    } catch (ignored) {
      return true
    } finally {
      this.decoder.reset()
    }
    // e.g. incomplete input
    return true
  }
}

export class Runner {
  constructor() {
    this.ok = 0
    this.skipped = 0
    this.notOk = 0
    this.total = 0
  }

  run(test, desc, skipped = false) {
    this.total++
    if (skipped) {
      try {
        test(true)
        console.log(`not ok ${this.notOk++} ${desc} (EXPECTED FAILURE)`)
        return false
      } catch (ignored) {
        console.log(`skipped ${this.skipped++} ${desc}`)
        return true
      }
    } else {
      try {
        test(false)
        console.log(`ok ${this.ok++} ${desc}`)
        return true
      } catch (e) {
        console.log(`not ok ${this.notOk++} ${desc}
    ---
      ${util.inspect(e).replace(/\n/g, '\n    ')}
    ...
        `)
        return false
      }
    }
  }

  summary() {
    console.log(`
${this.notOk}..${this.skipped}..${this.total}
# tests: ${this.total}
# pass: ${this.ok}
# skipped: ${this.skipped}
# fail: ${this.notOk}
`)
    if (this.notOk > 0) {
      process.exit(1)
    }
  }
}
