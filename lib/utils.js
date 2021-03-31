const cache = {}

/**
 * @callback FetchArrayBuffer
 * @returns {Promise<Buffer|ArrayBuffer>}
 * @private
 */
/**
 * @typedef FetchResult
 * @property {FetchArrayBuffer} arrayBuffer
 * @private
 */
/**
 * A half-hearted
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API fetch}
 * implementation that uses node's fs.promises.  DO NOT USE in browser.
 *
 * @param {URL} url - the URL to fetch, including file:
 * @returns {Promise<FetchResult>}
 * @private
 */
async function fakeFetch(url) {
  // Dynamic import works on internal modules in node 12
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const fs = await import('fs')

  return {
    arrayBuffer() {
      // it returns a Buffer not an ArrayBuffer, but WebAssembly.compile
      // will work with Buffer

      // There is a mismatch in URL definitions.  See:
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34960
      // @ts-ignore
      return fs.promises.readFile(url)
    }
  }
}

/**
 * Fetch a file with a file name relative to this one.
 * @param {string} file - name of file to fetch
 * @returns {Promise<Buffer|ArrayBuffer>} the file contents
 * @private
 */
async function fetchRelative(file) {
  const src = new URL(file, import.meta.url)
  // We're only going to use fakeFetch in the unit tests
  /* c8 ignore next */
  const response = globalThis.fetch ?
    await globalThis.fetch(src.toString()) :
    await fakeFetch(src)
  return response.arrayBuffer()
}

/**
 * Load a WASM library, relative to this file.
 * {@linkcode WasmLib#init WasmLib.init} MUST be called.
 */
export class WasmLib {
  /**
   * @param {string} fileName - name of the WASM file, relative to this one
   */
  constructor(fileName) {
    this.fileName = fileName
    /** @type {WebAssembly.Module?} */
    this.compiled = cache[this.fileName]
  }

  /**
   * Instantiate the library.  The first time this is called for a given
   * library, the library will be fetched and compiled before instantiation.
   * @param {object} [env={}] - the environment to be passed to the library.
   * @returns {Promise<object>} the exports of the library instance, with C
   *   globals converted to their values.
   */
  async init(env = {}) {
    if (!this.compiled) {
      const buf = await fetchRelative(this.fileName)
      cache[this.fileName] = this.compiled = await WebAssembly.compile(buf)
    }
    const m = await WebAssembly.instantiate(this.compiled, { env })
    if (typeof m.exports.__wasm_call_ctors === 'function') {
      m.exports.__wasm_call_ctors()
    }

    /* c8 ignore start */
    if (!(m.exports.memory instanceof WebAssembly.Memory)) {
      // STFU, tsc
      throw new Error('Invalid exports, Memory required')
    }
    /* c8 ignore stop */

    const mem = m.exports.memory
    const u32 = new Int32Array(mem.buffer)
    const ret = {
      ...m.exports
    }
    for (const [k, v] of Object.entries(m.exports)) {
      if (v instanceof WebAssembly.Global) {
        const val = v.value
        // all of the built-in globals return values, the ones that C
        // exports return pointers to values.  Built-ins all start with "__"
        ret[k] = k.startsWith('__') ? val : u32[val / 4]
      }
    }
    return ret
  }
}

/**
 * Concatenate Uint8Array's.
 * @param {Array<Uint8Array>} arrays - the arrays to concat
 * @returns {Uint8Array} concatenated
 */
export function concat(arrays) {
  const len = arrays.reduce((t, v) => t + v.length, 0)
  const ret = new Uint8Array(len)
  let offset = 0
  for (const a of arrays) {
    ret.set(a, offset)
    offset += a.length
  }
  return ret
}

/**
 * Convert to a hex string
 * @param {Uint8Array} buf - bytes
 * @returns {string} hex
 */
export function toHex(buf) {
  return buf.reduce((t, i) => t + ('0' + i.toString(16)).slice(-2), '')
}

/**
 * Convert from a hex string
 * @param {string} str - hex
 * @returns {Uint8Array} bytes
 */
export function fromHex(str) {
  const buf = new Uint8Array(Math.ceil(str.length / 2))
  buf.forEach((_, i) => (buf[i] = parseInt(str.substr(i * 2, 2), 16)))
  return buf
}
