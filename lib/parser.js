import {fromHex, WasmLib} from './utils.js'
const lib = new WasmLib('library.wasm')

/**
  * @callback ParserEvent
  * @param {number} mt - Major Type, one of MT
  * @param {number} bytes - Number of bytes or items
  * @param {number} phase - parsing phase, one of PHASES
  * @param {number} line - Line number from library.c, source of the event
  */

/**
  * @callback ParserCallback
  * @param {Error} [error] - if one was generated
  * @param {any} [value] - the decoded value if no error
  */

/**
 * @type ParserCallback
 * @private
 */
const defaultCallback = (er, x) => {
  console.log(er || x)
}

/**
 * @typedef ParserOptions - options for Parser
 * @property {ParserCallback} [callback=defaultCallback] - to be called when an
 *   item is decoded.  NOT called by base class ever.
 * @property {boolean} [verbose=false] - print out the {@link ParserEvent}
 */

/**
 * Base class for use of the WASM library.  Loads, compiles, and instantiates
 * WASM, and sets up memory for calling in both directions.
 *
 * @property {number} parser - pointer to parser structure in WASM memory
 * @property {number} data - pointer to start of input data area in WASM memory
 * @property {Uint8Array} writeBuffer - a view over the memory the parser
 *   can read from starting at {@linkcode data}.  You can use this instead of
 *   passing bytes into {@linkcode Parser#write} to avoid a copy.
 * @property {number} max - length of {@linkcode writeBuffer}
 */
export class Parser {
  /**
   * Create
   *
   * @param {ParserOptions|ParserCallback} [opts = {}] - options or callback
   *   function
   */
  constructor(opts = {}) {
    if (typeof opts === 'function') {
      opts = {
        callback: opts
      }
    }
    this.opts = {
      verbose: false,
      callback: defaultCallback,
      ...opts
    }
    /** @type {number?} */
    this.parser = null
    this.td = new TextDecoder()
  }

  /**
   * Reset the state of the parser, for example, after an error.
   */
  reset() {
    this.mod.init_parser(this.parser)
  }

  /**
   * Initializes this instance.  MUST be called and awaited for before anything
   * else is called.
   */
  async init() {
    /** @type {object} */
    this.mod = await lib.init({event: this._event.bind(this)})
    this.parser = this.mod.__heap_base
    /** @type {number} */
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

  /**
   * Process an event
   *
   * @param {number} mt - Major Type, one of MT
   * @param {number} bytes - Number of bytes or items
   * @param {number} phase - parsing phase, one of PHASES
   * @param {number} line - Line number from library.c, source of the event
   * @returns {void}
   * @abstract
   * @protected
   */

  /* c8 ignore start */
  // eslint-disable-next-line class-methods-use-this
  _event(mt, bytes, phase, line) {
    throw new Error('Override in base class')
  }
  /* c8 ignore stop */

  /**
   * Write some bytes to the WASM library, generating synchronous events
   * as needed for the received bytes.
   *
   * @param {Uint8Array|String} [buf] - Bytes to write.  If string, it must
   *   be encoded as hex.  If null, use
   *   {@linkcode Parser#writeBuffer this.writeBuffer} directly, without
   *   the need to copy.
   * @param {number} [start=0] - where to start processing, in bytes
   * @param {number} [end=buf.length] - where to end processing, in bytes.  If
   *   buf is null, REQUIRED
   * @returns {number} number of bytes used.  This will be less than
   *   (end - start) if a full CBOR item is found.
   * @throws {Exception} when buf and end are both null
   */
  write(buf, start, end) {
    if (start == null) {
      start = 0
    }
    if (buf != null) {
      if (typeof buf === 'string') {
        buf = fromHex(buf)
      }
      if (end == null) {
        end = buf.length
      }
      this.writeBuffer.set(buf, start)
      return this.mod.parse(this.parser, this.data, end)
    }
    if (end == null) {
      throw new Error('`end` is required when using writeBuffer')
    }
    return this.mod.parse(this.parser, this.data + start, end - start)
  }

  /**
   * Get the parser's last value
   *
   * @param {number} mt - Major Type, one of MT
   * @param {number} bytes - Number of bytes or items
   * @param {number} phase - parsing phase, one of PHASES
   * @param {number} line - Line number from library.c, source of the event
   */
  baseEvent(mt, bytes, phase, line) {
    const val = this.lastVal()
    if (this.opts.verbose) {
      console.log('%O', {
        mt: MT[mt], bytes, val, phase: PHASES[phase], line
      })
    }
    return val
  }
}

/**
 * @typedef {Object} PHASES - compilation phases
 * @property {number} BEGIN - 0
 * @property {number} BETWEEN_ITEMS - 1
 * @property {number} AFTER_ITEMS - 2
 * @property {number} FINISH - 3
 * @property {number} ERROR - 4
 */
export const PHASES = {}
for (const [i, p] of [
  'BEGIN', 'BETWEEN_ITEMS', 'AFTER_ITEM', 'FINISH', 'ERROR'
].entries()) {
  PHASES[i] = p
  PHASES[p] = i
}

/**
 * @typedef {Object} MT - Major Types
 * @property {number} POS - 0
 * @property {number} NEG - 1
 * @property {number} BYTES - 2
 * @property {number} UTF8 - 3
 * @property {number} ARRAY - 4
 * @property {number} MAP - 5
 * @property {number} TAG - 6
 * @property {number} SIMPLE - 7
 */
export const MT = {}
for (const [i, p] of [
  'POS', 'NEG', 'BYTES', 'UTF8', 'ARRAY', 'MAP', 'TAG', 'SIMPLE'
].entries()) {
  MT[i] = p
  MT[p] = i
}
