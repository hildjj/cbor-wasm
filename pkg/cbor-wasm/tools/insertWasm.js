import fs from 'fs'

const parser = new URL('../lib/parser.js', import.meta.url)
const orig = fs.readFileSync(parser, 'utf8')
const wasm = fs.readFileSync(new URL('../lib/library.wasm', import.meta.url))

if (wasm.length >= 4096) {
  throw new Error('Embedding synchronous WASM only works for < 4kB files')
}

const m = orig.match(/const\s+wasm64\s*=\s*'([^']*)'/)
if (!m) {
  throw new Error(`Replacement site not found in ${parser.href}`)
}

const wasm64 = wasm.toString('base64')
if (m[1] !== wasm64) {
  console.log('Embedding WASM')
  const inserted = orig.substring(0, m.index) +
    'const wasm64 = \'' +
    wasm64 +
    '\'' +
    orig.substring(m.index + m[0].length)
  fs.writeFileSync(parser, inserted, 'utf8')
}
