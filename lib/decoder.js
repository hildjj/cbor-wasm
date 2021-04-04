import {concat, toHex} from './utils.js'
import {Parser, PHASES, MT} from './parser.js'
import {fromHex} from './utils.js'

const BREAK = Symbol('BREAK')
const NONE = Symbol('NONE')

/**
 * Unknown simple value
 * @property {number} val - the simple value
 */
export class Simple {
  /**
   * @param {bigint} val - the simple value
   */
  constructor(val) {
    this.val = Number(val)
  }
}

/**
 * Unknown tag
 * @property {number} tag - the tag number
 * @property {any} val - the value inside the tag
 */
export class Tag {
  /**
   * @param {bigint} tag - the tag number
   * @param {any} val - the value inside the tag
   */
  constructor(tag, val) {
    this.tag = tag
    this.val = val
  }

  /**
   * Decode known tags, or return an instance of {@linkcode Tag}
   * @param {bigint} tag - tag number
   * @param {any} val - the value
   * @returns {Tag|any} a Tag if the tag number is unknown, otherwise a coerced
   *   value
   */
  static decode(tag, val) {
    switch (tag) {
      case 2n:
        return BigInt('0x' + toHex(val))
      case 3n:
        return -1n - BigInt('0x' + toHex(val))
      default:
        return new Tag(tag, val)
    }
  }
}

/**
 * Decode events from the WASM library into JS objects
 */
export class Decoder extends Parser {
  /**
   * @param {import('./parser.js').ParserOptions |
   *   import('./parser.js').ParserCallback
   * } [opts={}] - options or callback function
   */
  constructor(opts) {
    super(opts)
    this.stack = []
  }

  /**
   * @callback DecoderFunction
   * @param {string|Uint8Array} input - The input to parse.  Should be a single
   *   complete CBOR item.
   * @returns {any} the decoded item
   * @throws {Error} on decoding errors, input too short
   */
  /**
   * Convenience function for decoding single complete CBOR inputs.  You still
   * have to await this function for WASM setup, but the function it returns
   * is synchronous.
   * @returns {Promise<DecoderFunction>}
   */
  static async decoder() {
    let res = NONE
    const d = new Decoder((er, x) => {
      if (er) {
        throw er
      }
      res = x
    })
    await d.init()

    return inp => {
      try {
        res = NONE
        if (typeof inp === 'string') {
          inp = fromHex(inp)
        }
        let tot = 0
        const len = inp.length
        while (tot < len) {
          tot += d.write(inp, tot)
          if (res !== NONE) {
            break
          }
        }

        if (res === NONE) {
          throw new Error('Incomplete input')
        }
        return res
      } finally {
        d.reset()
      }
    }
  }

  /**
   * Reset the decoder state, for example after an error
   */
  reset() {
    super.reset()
    this.stack = []
  }

  _event(mt, bytes, phase, line) {
    const val = this.baseEvent(mt, bytes, phase, line)
    if (mt === this.mod.FAIL) {
      this.opts.callback.call(
        this,
        new Error(`Parse failed, library.c:${val} at input char ${bytes}`)
      )
      return
    }
    if (phase === PHASES.BETWEEN_ITEMS) {
      return
    }
    let ret = null
    switch (mt) {
      case MT.POS:
        ret = (val <= Number.MAX_SAFE_INTEGER) ? Number(val) : val
        break
      case MT.NEG:
        ret = (val <= Number.MAX_SAFE_INTEGER) ? -1 - Number(val) : -1n - val
        break
      case MT.BYTES:
        switch (phase) {
          case PHASES.BEGIN:
            this.stack.push([])
            return
          case PHASES.AFTER_ITEM:
            if (bytes > 0) {
              const start = this.data + Number(val)
              this.stack[this.stack.length - 1].push(
                this.mem.slice(start, start + bytes)
              )
            } else {
              // streaming mode
              const n = this.stack.pop()
              if (n !== BREAK) {
                this.stack[this.stack.length - 1].push(n)
              }
            }
            return
          case PHASES.FINISH:
            ret = concat(this.stack.pop())
            break
        }
        break
      case MT.UTF8:
        switch (phase) {
          case PHASES.BEGIN:
            this.stack.push([])
            return
          case PHASES.AFTER_ITEM:
            if (bytes > 0) {
              const start = this.data + Number(val)
              this.stack[this.stack.length - 1].push(
                this.mem.slice(start, start + bytes)
              )
            } else {
              // streaming mode
              const n = this.stack.pop()
              if (n !== BREAK) {
                this.stack[this.stack.length - 1].push(n)
              }
            }
            return
          case PHASES.FINISH: {
            // don't convert until the end.
            // Otherwise might split a UTF8 series.
            // each streaming chunk is valid UTF8 however.
            const chunks = this.stack.pop()
            if (chunks.length === 0) {
              ret = ''
            } else if (typeof chunks[0] === 'string') {
              // streaming mode
              ret = chunks.reduce((t, v) => t + v, '')
            } else {
              ret = this.td.decode(concat(chunks))
            }
            break
          }
        }
        break
      case MT.ARRAY:
        switch (phase) {
          case PHASES.BEGIN:
            this.stack.push([])
            return
          case PHASES.AFTER_ITEM: {
            const n = this.stack.pop()
            if (n !== BREAK) {
              this.stack[this.stack.length - 1].push(n)
            }
            return
          }
          case PHASES.FINISH:
            ret = this.stack.pop()
            break
        }
        break
      case MT.MAP: {
        switch (phase) {
          case PHASES.BEGIN:
            this.stack.push([])
            return
          case PHASES.AFTER_ITEM: {
            const n = this.stack.pop()
            if (n !== BREAK) {
              this.stack[this.stack.length - 1].push(n)
            }
            return
          }
          case PHASES.FINISH: {
            const entries = this.stack.pop()
            if (entries.length % 2 !== 0) {
              this.opts.callback.call(
                this,
                new Error('Odd number of map entries')
              )
              return
            }
            if (entries.every((v, i) => (i % 2) || (typeof v === 'string'))) {
              ret = {}
              for (let i = 0; i < entries.length; i += 2) {
                ret[entries[i]] = entries[i + 1]
              }
            } else {
              ret = new Map()
              for (let i = 0; i < entries.length; i += 2) {
                ret.set(entries[i], entries[i + 1])
              }
            }
          }
        }
        break
      }
      case MT.TAG:
        switch (phase) {
          case PHASES.BEGIN:
            this.stack.push(val)
            return
          case PHASES.AFTER_ITEM:
            return
          case PHASES.FINISH: {
            const inner = this.stack.pop()
            const tag = this.stack.pop()
            ret = Tag.decode(tag, inner)
            break
          }
        }
        break
      case MT.SIMPLE: {
        switch (bytes) {
          case 0:
          case 1:
            switch (val) {
              case 20n:
                ret = false
                break
              case 21n:
                ret = true
                break
              case 22n:
                ret = null
                break
              case 23n:
                ret = undefined
                break
              case 31n:
                ret = BREAK // future-proof
                break
              default:
                ret = new Simple(val)
            }
            break
          case 2: {
            ret = this.mod.float16(this.parser)
            break
          }
          case 4: {
            ;[ret] = this.f32
            break
          }
          case 8: {
            ret = this.mod.float64(this.parser)
            break
          }
        }
        break
      }
    }
    if (this.stack.length) {
      this.stack.push(ret)
      if (this.opts.verbose) {
        console.log({stack: this.stack})
      }
    } else {
      this.opts.callback.call(this, null, ret)
    }
  }
}
