import {Parser, PHASES, MT} from './parser.js'
import {toHex} from './utils.js'

const NONE = Symbol('NONE')

/**
 * Decode WASM library events into CBOR diagnostic notation.
 */
export class Diagnose extends Parser {
  /**
   * @param {import('./parser.js').ParserOptions |
   *   import('./parser.js').ParserCallback
   * } [opts={}] - options or callback function
   */
  constructor(opts) {
    super(opts)
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
    /** @type {string|Symbol} */
    let ret = NONE
    switch (mt) {
      case MT.POS:
        ret = val.toString()
        break
      case MT.NEG:
        ret = ((val <= Number.MAX_SAFE_INTEGER) ? -1 - Number(val) : -1n - val)
          .toString()
        break
      case MT.BYTES:
        switch (phase) {
          case PHASES.BEGIN:
            ret = (bytes === -1) ? '(_ ' : 'h\''
            break
          case PHASES.BETWEEN_ITEMS:
            ret = ', '
            break
          case PHASES.AFTER_ITEM: {
            const start = this.data + Number(val)
            ret = toHex(this.memU8.slice(start, start + bytes))
            break
          }
          case PHASES.FINISH:
            ret = (val === 0x1fn) ? ')' : '\''
            break
        }
        break
      case MT.UTF8:
        switch (phase) {
          case PHASES.BEGIN:
            ret = (bytes === -1) ? '(_ ' : '"'
            break
          case PHASES.BETWEEN_ITEMS:
            ret = ', '
            break
          case PHASES.AFTER_ITEM: {
            const start = this.data + Number(val)
            // TODO: deal with multiple chunks
            ret = this.td.decode(this.memU8.slice(start, start + bytes))
            break
          }
          case PHASES.FINISH:
            ret = (val === 0x1fn) ? ')' : '"'
            break
        }
        break
      case MT.ARRAY:
        switch (phase) {
          case PHASES.BEGIN:
            ret = (bytes === -1) ? '[_ ' : '['
            break
          case PHASES.BETWEEN_ITEMS:
            ret = ', '
            break
          case PHASES.FINISH:
            ret = ']'
            break
        }
        break
      case MT.MAP:
        switch (phase) {
          case PHASES.BEGIN:
            ret = (bytes === -1) ? '{_ ' : '{'
            break
          case PHASES.BETWEEN_ITEMS:
            ret = (val % 2n) ? ': ' : ', '
            break
          case PHASES.FINISH:
            ret = '}'
            break
        }
        break
      case MT.TAG:
        switch (phase) {
          case PHASES.BEGIN:
            ret = `${val}(`
            break
          case PHASES.FINISH:
            ret = ')'
            break
        }
        break
      case MT.SIMPLE: {
        /** @type {number|Symbol} */
        let num = NONE
        switch (bytes) {
          case 0:
          case 1:
            switch (val) {
              case 20n:
                ret = 'false'
                break
              case 21n:
                ret = 'true'
                break
              case 22n:
                ret = 'null'
                break
              case 23n:
                ret = 'undefined'
                break
              case 31n:
                // BREAK.  Ignore.
                return
              default:
                ret = `simple(${val})`
                break
            }
            break
          case 2: {
            num = this.mod.float16(this.parser)
            break
          }
          case 4: {
            num = this.memDV.getFloat32(this.parser, true)
            break
          }
          case 8: {
            num = this.memDV.getFloat64(this.parser, true)
            break
          }
        }
        if (num !== NONE) {
          if (Number.isNaN(num)) {
            ret = 'NaN'
          } else if (!Number.isFinite(num)) {
            ret = (num < 0) ? '-Infinity' : 'Infinity'
          } else if (Object.is(num, -0)) {
            ret = '-0'
          } else {
            ret = num.toString()
          }
          ret += `_${{2: 1, 4: 2, 8: 3}[bytes]}`
        }
        break
      }
    }
    if (ret !== NONE) {
      this.opts.callback.call(this, null, ret)
    }
  }
}
