const cache = {}

async function fakeFetch(url) {
  // Dynamic import works on internal modules in node 12
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const fs = await import('fs')

  return {
    arrayBuffer() {
      // it returns a Buffer not an ArrayBuffer, but WebAssembly.compile
      // will work with Buffer
      return fs.promises.readFile(url)
    }
  }
}

async function fetchRelative(file) {
  const src = new URL(file, import.meta.url)
  const fetch = globalThis.fetch || fakeFetch
  const response = await fetch(src)
  return response.arrayBuffer()
}

export class WasmLib {
  constructor(fileName, baseUrl) {
    this.fileName = fileName
    this.baseUrl = baseUrl
    this.compiled = cache[this.fileName]
  }

  async init(env) {
    if (!this.compiled) {
      const buf = await fetchRelative(this.fileName)
      this.compiled = cache[this.fileName] = await WebAssembly.compile(buf)
    }
    const m = await WebAssembly.instantiate(this.compiled, { env })
    if (typeof m.exports.__wasm_call_ctors === 'function') {
      m.exports.__wasm_call_ctors()
    }
    const u32 = new Int32Array(m.exports.memory.buffer)
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

export function toHex(buf) {
  return buf.reduce((t, i) => t + ('0' + i.toString(16)).slice(-2), '')
}

export function fromHex(str) {
  const buf = new Uint8Array(Math.ceil(str.length / 2))
  buf.forEach((_, i) => (buf[i] = parseInt(str.substr(i * 2, 2), 16)))
  return buf
}
