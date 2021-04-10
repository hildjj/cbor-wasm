import {fromHex, fromBase64} from './utils.js'

// eslint-disable-next-line max-len
const wasm64 = 'AGFzbQEAAAABGwVgBH9/f38AYAAAYAF/AGADf39/AX9gAX8BfAINAQNlbnYFZXZlbnQAAAMFBAECAwQEBQFwAQEBBQMBAAIGPQp/AUGQiQQLfwBBgAkLfwBBhAkLfwBBiAkLfwBBgAgLfwBBjAkLfwBBgAgLfwBBkIkEC38AQQALfwBBAQsHuAEOBm1lbW9yeQIAEV9fd2FzbV9jYWxsX2N0b3JzAAELaW5pdF9wYXJzZXIAAgVwYXJzZQADB2Zsb2F0MTYABARGQUlMAwEJTUFYX0RFUFRIAwILUEFSU0VSX1NJWkUDAwxfX2Rzb19oYW5kbGUDBApfX2RhdGFfZW5kAwUNX19nbG9iYWxfYmFzZQMGC19faGVhcF9iYXNlAwcNX19tZW1vcnlfYmFzZQMIDF9fdGFibGVfYmFzZQMJCtIQBAIACwkAIABCCDcDCAufDwIKfwF+QQAhAwJAAkADQAJAIAAoAgwiBEEUSQ0AIAVCwQA3AxAMAgsgASADai0AACEGIAAgBEEYbGoiB0EQaiEFAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAAoAggODgMDBAQFBQYDAAECBwgJCgsgAyACTg0QIAUgBkEFdiIINgIAIAdBIGoiCUIANwMAIAdBFGoiCkIANwIAQQIhC0EAIQwCQAJAAkACQAJAAkAgBkEfcSIGQQJ0QYCIgIAAaigCAEF+ag4GAQIDBAUVAAsgCkEENgIAQQYhCwsgCiALNgIAIAshDAsgCiAMQQFqIgw2AgALIABBCTYCCCAHQRhqIAxBAWoiBzYCACAKIAc2AgAgA0EBaiEDDBALIABBCjYCCCAJIAatNwMAIANBAWohAwwPCwJAAkAgCEF+akEESQ0AIAhBB0cNASAKQQA2AgAgCSAGrTcDAAJAIARBAEoNACAJQugANwMADBILAkAgBygCAEF/Rg0AIAlC7QA3AwAMEgsgB0EBNgIAIABBDTYCCCADQQFqIQMMEAsgCUIANwMAIApBfzYCACAAQQo2AgggA0EBaiEDDA8LIAlC/gA3AwAMDwsgA0EBaiEEAkAgAyACSA0AIAQPCyAHQRhqIgMgAygCAEF/aiIKNgIAIAdBIGoiDCAMKQMAQgiGIAathCINNwMAIAQhAyAKDQ0CQAJAAkACQAJAIAdBFGooAgBBf2oOCAABBAIEBAQDBAsCQCAFKAIAQQdHDQAgDUIfVg0EIAxCjQE3AwAgBCEDDBMLIA1CF1YNAyAMQpABNwMAIAQhAwwSCyANQv8BVg0CIAUoAgBBB0YNAiAMQpUBNwMAIAQhAwwRCyANQv//A1YNASAFKAIAQQdGDQEgDEKbATcDACAEIQMMEAsgDUL/////D1YNACAFKAIAQQdGDQAgDEKhATcDACAEIQMMDwsgAEEKNgIIIAQhAwwNCwJAIARBAUgNACAAIARBf2pBGGxqIgdBIGopAwAiDVANACAAIA03AwAgB0EQaigCACAHQRRqKAIAQQFBrgEQgICAgAALIAAgBSgCADYCCAwMCyAAQQw2AgggACAHQSBqKQMANwMAIAUoAgAgB0EUaigCAEEDQbgBEICAgIAADAsLIAAgB0EgaiIEKQMANwMAIAUoAgAgB0EUaiIGKAIAQQBBvQEQgICAgAACQAJAIAYoAgBBf0cNACAAQQg2AgggACAAKAIMIgZBAWo2AgwgB0EYakF/NgIAIAZBE0gNASAEQsIBNwMADA0LAkACQCAEKQMAIg1QRQ0AQQ0hBkEBIQwMAQsgBiANpyIMNgIAQQshBgsgACAGNgIIIAdBGGogDDYCAAsgBEIANwMADAoLIAAgB0EgaiIGKQMANwMAIAUoAgAgB0EUaiIEKAIAQQBB0AEQgICAgAACQCAEKAIAQX9HDQAgBEF/NgIAIAZCADcDACAHQRhqQX82AgAMCAsgBikDACENIAZCADcDACAHQRhqIA0gBSgCAEF8aq2GpyIHNgIAIAQgBzYCACAHDQcgAEENNgIIDAkLIAAgB0EgaiIEKQMANwMAIAUoAgAgB0EUaiIHKAIAQQBB3QEQgICAgAAgBEIBNwMAIAdCgYCAgBA3AgAgACAAKAIMIgdBAWo2AgwgB0ETSA0HIARC3wE3AwAMCQsgAyACTg0JIAdBIGogA6wiDTcDACAHQRRqIAdBGGoiBigCACIEIAIgA2siByAEIAdIGyIHNgIAIAYgBCAHayIENgIAAkAgBA0AIABBDTYCCCAGQQE2AgALIAcgA2ohAyAAIA03AwAgBSgCACAHQQJB7wEQgICAgAAMBwsCQCAEQQFIDQAgACAEQX9qQRhsaiIGQRBqIgsoAgAhDCAGQRRqKAIAIgpBf0cNAyAMQX5xQQJHDQMCQAJAIAUoAgAiCUEHRw0AIAdBFGooAgANACAMQQdGDQUgB0EgaikDAEIfUg0BDAULIAwgCUcNACAHQRRqKAIAQX9HDQQLIAAgBEEYbGpBIGpC+QE3AwAMCAsgAEEINgIIIAMPCwJAAkACQCAFKAIAIgRBB0cNACAHQRRqKAIARQ0BCyAAQgA3AwBBACEHDAELIABCH0IAIAdBIGopAwBCH1EiBxs3AwALIARBACAHQQFza0EDQZICEICAgIAAIAAoAgxBAU4NAiAAQQg2AgggAw8LIAAgBEEYbGpBIGpCnAI3AwAMBQsgACAGQSBqIgQpAwAiDTcDACAEIA1CAXw3AwAgDCAKQQJB/QEQgICAgAAgBkEYaiIEKAIAIgZBf0YNAiAEIAZBf2oiBjYCACAGDQIgACAAKAIMQX9qNgIMQgAhDQJAIAUoAgBBB0cNACAHQRRqKAIADQBCH0IAIAdBIGopAwBCH1EbIQ0LIAAgDTcDACALKAIAQX9BA0GCAhCAgICAACAAKAIMQQBKDQAgAEEINgIIIAMPCyAAQQw2AggMAgsgACAAKAIMIgdBAWo2AgwgB0ETSA0AIAZC1wE3AwAMAgsgAEEINgIIDAALCyAAQQg2AgggACAFKQMQNwMAQYB/IANBBEGjAhCAgICAAAsgAwuhAQICfwF+IAAvAQAiAEGAgAJxIQEgAEH/B3EhAgJAAkAgAEGA+AFxIgBBgPgBRg0AIAANAQJAIAINAEQAAAAAAAAAgEQAAAAAAAAAACABGw8LQgAgAq0iA30gAyABG7pEAAAAAAAAcD6iDwtEAAAAAAAA+H9EAAAAAAAA8H8gAhtBf0EBIAEbt6IPCyAAQYCAP2ogAnKtQiqGIAGtQjCGhL8LC5QBAQBBgAgLjAEFAAAABQAAAAUAAAAFAAAABQAAAAUAAAAFAAAABQAAAAUAAAAFAAAABQAAAAUAAAAFAAAABQAAAAUAAAAFAAAABQAAAAUAAAAFAAAABQAAAAUAAAAFAAAABQAAAAUAAAAEAAAAAwAAAAIAAAABAAAABwAAAAcAAAAHAAAABgAAAID///8UAAAA8AEAAA=='
const lib = new WebAssembly.Module(fromBase64(wasm64))

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

    // sync instantiate
    const instance = new WebAssembly.Instance(lib, {
      env: {
        event: this._event.bind(this)
      }
    })

    /** @type {object} */
    this.mod = { ...instance.exports }
    this.mod.__wasm_call_ctors()
    this.memDV = new DataView(this.mod.memory.buffer)
    this.memU8 = new Uint8Array(this.mod.memory.buffer)

    for (const [k, v] of Object.entries(instance.exports)) {
      if (v instanceof WebAssembly.Global) {
        const val = v.value
        // all of the built-in globals return values, the ones that C
        // exports return pointers to values.  Built-ins all start with "__"
        // and WASM is always little-endian
        this.mod[k] = k.startsWith('__') ? val : this.memDV.getInt32(val, true)
      }
    }

    /** @type {number} */
    this.parser = this.mod.__heap_base
    /** @type {number} */
    this.data = this.parser + this.mod.PARSER_SIZE
    this.writeBuffer = new Uint8Array(this.mod.memory.buffer, this.data)
    this.max = this.writeBuffer.length - 1
    this.reset()
  }

  /**
   * Reset the state of the parser, for example, after an error.
   */
  reset() {
    this.mod.init_parser(this.parser)
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
      let len = end - start
      if (len > this.max) {
        len = this.max
      }
      this.writeBuffer.set(buf.subarray(start, start + len))
      return this.mod.parse(this.parser, this.data, len)
    }
    if (end == null) {
      throw new Error('`end` is required when using writeBuffer')
    }
    if (end > this.max) {
      end = this.max
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
    const val = this.memDV.getBigUint64(this.parser, true)
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
