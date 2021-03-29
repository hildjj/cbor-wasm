import {fromHex, WasmLib} from './utils.mjs'
const lib = new WasmLib('library.wasm')

export class Parser {
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
    this.td = new TextDecoder()
  }

  reset() {
    this.mod.init_parser(this.parser)
  }

  async init() {
    this.mod = await lib.init({event: this._event.bind(this)})
    this.parser = this.mod.__heap_base
    this.data = this.parser + this.mod.PARSER_SIZE
    this.mem = new Uint8Array(this.mod.memory.buffer)
    this.writeBuffer = new Uint8Array(this.mod.memory.buffer, this.data)
    this.max = this.writeBuffer.length
    this.f32 = new Float32Array(this.mod.memory.buffer, this.parser, 1)

    // TODO: big-endian machine will have to swap bytes.
    // WASM ints are always LE, I think
    if (typeof BigUint64Array === 'undefined') {
      const last_val = new Uint32Array(this.mod.memory.buffer, this.parser, 2)
      this.lastVal = () => (BigInt(last_val[1]) << 32n) | BigInt(last_val[0])
    } else {
      const last_val =
        new BigUint64Array(this.mod.memory.buffer, this.parser, 1)
      this.lastVal = () => last_val[0]
    }

    this.reset()
  }

  write(buf, start, end) {
    if (start == null) {
      start = 0
    }
    if (end == null) {
      end = buf.length
    }
    if (typeof buf === 'string') {
      buf = fromHex(buf)
    }
    this.writeBuffer.set(buf)
    return this.mod.parse(this.parser, this.data, buf.length)
  }
}

export const PHASES = {}
for (const [i, p] of [
  'BEGIN', 'BETWEEN_ITEMS', 'AFTER_ITEM', 'FINISH', 'ERROR'
].entries()) {
  PHASES[i] = p
  PHASES[p] = i
}

export const MT = {}
for (const [i, p] of [
  'POS', 'NEG', 'BYTES', 'UTF8', 'ARRAY', 'MAP', 'TAG', 'SIMPLE'
].entries()) {
  MT[i] = p
  MT[p] = i
}
