import {Parser, PHASES, MT} from './parser.mjs'
import {toHex} from './utils.mjs'

const NONE = Symbol('NONE')

export class Diagnose extends Parser {
  constructor(opts) {
    super(opts)
  }

  _event(mt, bytes, phase, line) {
    const val = this.lastVal()
    if (this.opts.verbose) {
      console.log('%O', {
        mt: MT[mt], bytes, val, phase: PHASES[phase], line, stack: this.stack
      })
    }
    if (mt === this.mod.FAIL) {
      this.opts.callback.call(
        this,
        new Error(`Parse failed, library.c:${val} at input char ${bytes}`)
      )
      return
    }
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
          case PHASES.BEFORE_ITEM:
            ret = ', '
            break
          case PHASES.AFTER_ITEM: {
            const start = this.data + Number(val)
            ret = toHex(this.mem.slice(start, start + bytes))
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
          case PHASES.BEFORE_ITEM:
            ret = ', '
            break
          case PHASES.AFTER_ITEM: {
            const start = this.data + Number(val)
            // TODO: deal with multiple chunks
            ret = this.td.decode(this.mem.slice(start, start + bytes))
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
          case PHASES.BEFORE_ITEM:
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
          case PHASES.BEFORE_ITEM:
            ret = (val % 2n) ? ', ' : ': '
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
                ret = 'BREAK'
                break
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
            ;[num] = this.f32
            break
          }
          case 8: {
            num = this.mod.float64(this.parser)
            break
          }
        }
        if (num !== NONE) {
          if (Number.isNaN(num)) {
            ret = 'NaN'
          } else if (!Number.isFinite(num)) {
            ret = (num < 0) ? '-Infinity' : Infinity
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
