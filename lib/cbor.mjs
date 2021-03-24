let compiledModule = null
const BREAK = Symbol('BREAK')
const INSPECT = Symbol.for('nodejs.util.inspect.custom')

function globalInt(mod, name) {
  const ptr = mod.exports[name].value
  const buf = new Int32Array(mod.exports.memory.buffer, ptr, 4)
  return buf[0]
}

async function fetchRelative(file) {
  const src = new URL(file, import.meta.url)
  try {
    // Dynamic import added without flag in node 13.2.
    // works with --experimental-modules in node 12
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    const fs = await import('fs')
    return fs.promises.readFile(src) // works with file: URL
  } catch (ignored) {
    // We're in the browser or something like it
    // eslint-disable-next-line no-undef
    const response = await fetch(src)
    return response.arrayBuffer()
  }
}

async function init() {
  const wasmBuf = await fetchRelative('library.wasm')
  compiledModule = await WebAssembly.compile(wasmBuf)
}

async function wasmMod(event) {
  if (!compiledModule) {
    await init()
  }
  const m = await WebAssembly.instantiate(compiledModule, {
    env: {
      event,
      print(where, fmt) {
        console.log(`print(${where}): ${fmt}`)
      }
    }
  })
  m.exports.__wasm_call_ctors()
  return {
    ...m.exports,
    __heap_base: m.exports.__heap_base.value,
    __memory_base: m.exports.__memory_base.value,
    PARSER_SIZE: globalInt(m, 'PARSER_SIZE'),
    FAIL: globalInt(m, 'FAIL')
  }
}

function concat(arrays) {
  const len = arrays.reduce((t, v) => t + v.length, 0)
  const ret = new Uint8Array(len)
  let offset = 0
  for (const a of arrays) {
    ret.set(a, offset)
    offset += a.length
  }
  return ret
}

export class Simple {
  constructor(val) {
    this.val = val
  }

  [INSPECT]() {
    return `simple(${this.val})`
  }
}

function toHex(buf) {
  return buf.reduce((t, i) => t + (('0' + i).toString(16)).slice(-2), '')
}

export class Tag {
  constructor(tag, val) {
    this.tag = tag
    this.val = val
  }

  [INSPECT]() {
    // TODO this needs a full diagnostic generator to pass the tests
    return `${this.tag}(${this.val})`
  }

  static decode(tag, val) {
    switch (tag) {
      case 2n:
        return BigInt('0x' + toHex(val))
      case 3n:
        console.log('TAG3:', val, toHex(val), BigInt('0x' + toHex(val)))
        return -1n - BigInt('0x' + toHex(val))
      default:
        return new Tag(tag, val)
    }
  }
}

export class Decoder {
  constructor(opts = {}) {
    if (typeof opts === 'function') {
      opts = {
        callback: opts
      }
    }
    this.opts = {
      verbose: false,
      callback: (er, x) => console.log(er || x),
      ...opts
    }
    this.parser = null
    this.stack = []
    this.td = new TextDecoder()
    // TODO: big-endian machine will have to swap bytes.
    // WASM ints are always LE, I think
    this.u8 = new Uint8Array(8)
    this.f32 = new Float32Array(this.u8.buffer)
    this.f64 = new Float64Array(this.u8.buffer)
    this.u32 = new Uint32Array(this.u8.buffer)
    // Safari doesn't have BigInt64Array
    this.u64 = (typeof BigUint64Array !== 'undefined') ?
      this.u64 = new BigUint64Array(this.u8.buffer) :
      null
  }

  reset() {
    this.mod.init_parser(this.parser)
    this.stack = []
    this.u8.fill(0)
  }

  async init() {
    this.mod = await wasmMod(this._event.bind(this))
    this.parser = this.mod.__heap_base
    this.data = this.parser + this.mod.PARSER_SIZE
    this.mem = new Uint8Array(this.mod.memory.buffer)
    this.writeBuffer = new Uint8Array(this.mod.memory.buffer, this.data)
    this.max = this.writeBuffer.length
    this.reset()
  }

  static hex(str) {
    const buf = new Uint8Array(Math.ceil(str.length / 2))
    buf.forEach((_, i) => (buf[i] = parseInt(str.substr(i * 2, 2), 16)))
    return buf
  }

  write(buf, start, end) {
    if (start == null) {
      start = 0
    }
    if (end == null) {
      end = buf.length
    }
    if (typeof buf === 'string') {
      buf = Decoder.hex(buf)
    }
    this.writeBuffer.set(buf)
    // on Node 14, this will fail with "wasm function signature contains
    // illegal type", unless you run `node --experimental-wasm-bigint`
    return this.mod.parse(this.parser, this.data, buf.length)
  }

  _event(mt, bytes, val, line) {
    if (this.opts.verbose) {
      console.log('%O', {mt, bytes, val, line, stack: this.stack})
    }
    if (mt === this.mod.FAIL) {
      this.opts.callback.call(
        this,
        new Error(`Parse failed, library.c:${val} at input char ${bytes}`)
      )
      return
    }
    let ret = null
    switch (mt) {
      case 0:
        if (val < 0) {
          // 64-bit two's complement
          this.u64[0] = val
          ;[val] = this.u64
        }
        ret = (val <= Number.MAX_SAFE_INTEGER) ? Number(val) : val
        break
      case 1:
        if (val < 0) {
          // 64-bit two's complement
          // TODO: don't convert twice
          this.u64[0] = val
          ;[val] = this.u64
        }
        ret = (val <= Number.MAX_SAFE_INTEGER) ? -1 - Number(val) : -1n - val
        break
      case 2:
      case 3:
      case 4:
      case 5:
        this.stack.push([])
        return
      case -2:
        // -2, 5, 2: 5 byte chunk starting at char 2
        // -2, -1, -1: end
        // -2, -1, 0+: streaming chunk done
        if (bytes > 0) {
          const start = this.data + Number(val)
          this.stack[this.stack.length - 1].push(
            this.mem.slice(start, start + bytes)
          )
          return
        }
        if (val === -1n) {
          ret = concat(this.stack.pop())
        } else {
          const n = this.stack.pop()
          if (n !== BREAK) {
            this.stack[this.stack.length - 1].push(n)
          }
          return
        }
        break
      case -3:
        // -3, 5, 2: 5 byte chunk starting at char 2
        // -3, -1, -1: end
        // -3, -1, 0+: streaming chunk done
        if (bytes > 0) {
          const start = this.data + Number(val)
          this.stack[this.stack.length - 1].push(
            this.mem.slice(start, start + bytes)
          )
          return
        }
        if (val === -1n) {
          // don't convert until the end.
          // Otherwise might split a UTF8 series.
          // each streaming chunk is valid UTF8 however.
          const chunks = this.stack.pop()
          if (chunks.length === 0) {
            ret = ''
          } else if (typeof chunks[0] === 'string') {
            ret = chunks.reduce((t, v) => t + v, '')
          } else {
            ret = this.td.decode(concat(chunks))
          }
        } else {
          const n = this.stack.pop()
          if (n !== BREAK) {
            this.stack[this.stack.length - 1].push(n)
          }
          return
        }
        break
      case -4:
        if (val !== -1n) {
          const n = this.stack.pop()
          if (n !== BREAK) {
            this.stack[this.stack.length - 1].push(n)
          }
          return
        }
        ret = this.stack.pop()
        break
      case -5: {
        if (val !== -1n) {
          const n = this.stack.pop()
          this.stack[this.stack.length - 1].push(n)
          return
        }
        const entries = this.stack.pop().filter(x => x !== BREAK)
        if (entries.length % 2 !== 0) {
          throw new Error('Odd number of map entries')
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
        break
      }
      case 6:
        this.stack.push(val)
        return
      case -6: {
        if (val !== -1n) {
          return
        }
        const inner = this.stack.pop()
        const tag = this.stack.pop()
        ret = Tag.decode(tag, inner)
        break
      }
      case 7: {
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
              default:
                ret = new Simple(val)
            }
            break
          case 2: {
            // f16
            const nval = Number(val)
            const sign = (nval & 0x8000) ? -1 : 1
            const exp = (nval & 0x7C00) >> 10
            const mant = nval & 0x03ff
            if (!exp) {
              ret = sign * 5.9604644775390625e-8 * mant
            } else if (exp === 0x1f) {
              ret = sign * (mant ? NaN : Infinity)
            } else {
              ret = sign * Math.pow(2, exp - 25) * (1024 + mant)
            }
            break
          }
          case 4: {
            this.u32[0] = Number(val)
            ;[ret] = this.f32
            break
          }
          case 8: {
            if (!this.u64) {
              throw new Error('Unsupported platform: float64')
            }
            this.u64[0] = val
            ;[ret] = this.f64
            break
          }
        }
        break
      }
      case -7:
        ret = BREAK
        break
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
