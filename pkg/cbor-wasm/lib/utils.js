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

export function fromBase64(str) {
  // in this order to make unit testing work easier
  if (typeof atob === 'function') {
    // Must be on the web, so atob should work
    // eslint-disable-next-line no-undef
    return Uint8Array.from(atob(str), c => c.charCodeAt(0))
  }
  // Must be in node
  return Buffer.from(str, 'base64')
}
