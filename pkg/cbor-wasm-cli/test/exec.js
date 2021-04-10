import {spawn} from 'child_process'
import assert from 'assert'
import {Runner} from 'cbor-wasm/test/utils.js'

const NONE = Symbol('NONE')

function relFile(f) {
  return new URL(f, import.meta.url)
    .href
    .replace(/^file:\/\//, '')
}

function exec(bin, opts = {}) {
  opts = {
    args: [],
    encoding: 'utf8',
    env: {},
    ...opts
  }
  return new Promise((resolve, reject) => {
    bin = relFile(`../bin/${bin}.js`)
    const env = {
      ...process.env,
      ...opts.env
    }
    const c = spawn(bin, opts.args, {
      stdio: 'pipe',
      env
    })
    c.on('error', reject)
    const bufs = []
    c.stdout.on('data', b => bufs.push(b))
    c.stderr.on('data', b => bufs.push(b))
    c.on('close', code => {
      const buf = Buffer.concat(bufs)
      const str = buf.toString(opts.encoding)
      if (code !== 0) {
        const err = new Error(`process fail, code ${code}`)
        err.buf = buf
        err.str = str
        reject(err)
      } else {
        resolve(str)
      }
    })
    if (opts.stdin != null) {
      c.stdin.write(opts.stdin)
    }
    c.stdin.end()
  })
}

function runGood(r, opts, expected, desc) {
  return r.runAsync(async() => {
    let ret = NONE
    await assert.doesNotReject(async() => {
      ret = await exec('cbor-wasm', opts)
      // ignore line number changes
      ret = ret.replace(/line: \d+/g, () => 'line: xxx')
    })
    assert.deepEqual(ret, expected)
  }, desc)
}

async function main() {
  const r = new Runner()

  await runGood(r, { args: ['-h']}, `\
Usage: cbor-wasm [options] [command]

Options:
  -V, --version             output the version number
  -v, --verbose             Verbose logging
  -x, --hex                 Hex inputs from command line or interactively
  -h, --help                display help for command

Commands:
  js [files...]             convert CBOR to JavaScript
  diagnose|diag [files...]  convert CBOR to diagnostic string
  comment [files...]        output the commented version of a CBOR item
  help [command]            display help for command
`, 'cbor-wasm -h')

  await runGood(r, { args: ['js', '-h']}, `\
Usage: cbor-wasm js [options] [files...]

convert CBOR to JavaScript

Options:
  -h, --help  display help for command
`, 'cbor-wasm js -h')

  await runGood(r, { args: ['help', 'diag'] }, `\
Usage: cbor-wasm diagnose|diag [options] [files...]

convert CBOR to diagnostic string

Options:
  -h, --help  display help for command
`, 'cbor-wasm help diag')

  await runGood(r, { args: [relFile('fixtures/big.cbor')] }, `\
Uint8Array(127742) [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0,
  ... 127642 more items
]
`, 'js read file (default)')

  await runGood(r, {
    args: [
      'diag',
      relFile('fixtures/small.cbor')
    ]
  }, '[0]\n', 'diag read small file')

  await runGood(r, {
    args: ['diag', '-v'],
    stdin: Buffer.from('00', 'hex')
  }, `\
Reading: "-"
{ mt: 'POS', bytes: 0, val: 0n, phase: 'FINISH', line: xxx }
0
`, 'default to stdin, verbose')

  await runGood(r, {
    args: ['-x', '818120']
  }, '[ [ -1 ] ]\n', 'hex js cmd line')

  await runGood(r, {
    args: ['diag', '-v', '-x', '818120']
  }, `\
WRITE: "818120"
{ mt: 'ARRAY', bytes: 0, val: 1n, phase: 'BEGIN', line: xxx }
[{ mt: 'ARRAY', bytes: 0, val: 1n, phase: 'BEGIN', line: xxx }
[{ mt: 'NEG', bytes: 0, val: 0n, phase: 'FINISH', line: xxx }
-1{ mt: 'ARRAY', bytes: 1, val: 0n, phase: 'AFTER_ITEM', line: xxx }
{ mt: 'ARRAY', bytes: -1, val: 0n, phase: 'FINISH', line: xxx }
]{ mt: 'ARRAY', bytes: 1, val: 0n, phase: 'AFTER_ITEM', line: xxx }
{ mt: 'ARRAY', bytes: -1, val: 0n, phase: 'FINISH', line: xxx }
]
`, 'hex diag verbose cmd line')

  await runGood(r, {
    args: ['-x', '-v'],
    stdin: '81 00'
  }, `\
WRITE: "81"
{ mt: 'ARRAY', bytes: 0, val: 1n, phase: 'BEGIN', line: xxx }
WRITE: "00"
{ mt: 'POS', bytes: 0, val: 0n, phase: 'FINISH', line: xxx }
{ stack: [ [], 0 ] }
{ mt: 'ARRAY', bytes: 1, val: 0n, phase: 'AFTER_ITEM', line: xxx }
{ mt: 'ARRAY', bytes: -1, val: 0n, phase: 'FINISH', line: xxx }
[ 0 ]
`, 'readline js')

  await runGood(r, {
    args: ['diag', '-x'],
    stdin: '81 00'
  }, '[0]\n', 'readline js')

  await r.runAsync(async() => {
    const ret = await exec('cbor-wasm', {
      args: ['-x'],
      env: {
        CBOR_WASM_STDIN_TTY: 1
      },
      stdin: ''
    })
    assert.deepEqual(ret, 'cbor-wasm> ')
  })

  await r.runAsync(() => assert.rejects(() => exec('cbor-wasm', {
    args: [ 'js', '-x'],
    stdin: 'ff'
  })), 'bad hex js')

  await r.runAsync(() => assert.rejects(() => exec('cbor-wasm', {
    args: [ 'js', relFile('fixtures/goodbad.cbor') ]
  })), 'bad js')

  await r.runAsync(() => assert.rejects(() => exec('cbor-wasm', {
    args: [ 'diag', relFile('fixtures/goodbad.cbor') ]
  })), 'bad diag')

  r.summary()
}

main().catch(console.error)
