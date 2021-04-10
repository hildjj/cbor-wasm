#!/usr/bin/env node

import { Decoder, Diagnose, Comment } from 'cbor-wasm'
import { Command } from 'commander'
import fs from 'fs'
import util from 'util'

// fs.promises doesn't work with an fd, and we want to also read from stdin
// sometimes
const open = util.promisify(fs.open)
const read = util.promisify(fs.read)
const close = util.promisify(fs.close)

const version = (
  () => JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url))
  ).version
)()

const program = new Command()
  .version(version)
  .option('-v, --verbose', 'Verbose logging')
  .option('-x, --hex', 'Hex inputs from command line or interactively')

async function eachFile(d, files, opts) {
  if (files.length === 0) {
    files.push('-')
  }

  let bytesRead = null
  let f = null
  for (const fn of files) {
    try {
      if (opts.verbose) {
        console.log(`Reading: "${fn}"`)
      }
      f = 0 // process.stdin.fd throws EAGAIN, at least on MacOS
      if (fn !== '-') {
        f = await open(fn, 'r')
      }
      let start = 0
      do {
        ;({bytesRead} = await read(f, d.writeBuffer, 0, d.max, null))
        if (bytesRead) {
          start = 0
          do {
            start += d.write(null, start, bytesRead)
          } while (start < bytesRead)
        }
      } while (bytesRead)
    } finally {
      if (f) {
        await close(f)
      }
    }
  }
}

async function eachHex(d, files, opts) {
  if (files.length > 0) {
    for (const hex of files) {
      if (opts.verbose) {
        console.log(`WRITE: "${hex}"`)
      }
      d.write(hex)
    }
    return undefined
  }

  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const readline = await import('readline')
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: (process.stdin.isTTY || process.env.CBOR_WASM_STDIN_TTY) ?
        'cbor-wasm> ' :
        ''
    })
    rl.on('line', line => {
      try {
        for (const hex of line.split(/\s+/)) {
          if (opts.verbose) {
            console.log(`WRITE: "${hex}"`)
          }
          d.write(hex)
        }
        if (opts.newline) {
          process.stdout.write('\n')
        }
      } catch (e) {
        reject(e)
      }
      rl.prompt()
    })
    rl.on('close', resolve)
    rl.prompt()
  })
}

async function each(d, files, opts) {
  if (opts.hex) {
    await eachHex(d, files, opts)
  } else {
    await eachFile(d, files, opts)
  }
}

program
  .command('js [files...]', { isDefault: true })
  .description('convert CBOR to JavaScript')
  .action(async(files, opts, p) => {
    opts = {...p.parent.opts(), ...opts}
    const d = new Decoder({
      callback(er, x) {
        if (er) {
          throw er
        } else {
          console.log(x)
        }
      },
      verbose: opts.verbose
    })
    opts.newline = false
    await each(d, files, opts)
  })

program
  .command('diagnose [files...]')
  .alias('diag')
  .description('convert CBOR to diagnostic string')
  .action(async(files, opts, p) => {
    opts = {...p.parent.opts(), ...opts}
    const d = new Diagnose({
      callback(er, x) {
        if (er) {
          throw er
        } else {
          process.stdout.write(x)
        }
      },
      verbose: opts.verbose
    })
    opts.newline = true
    await each(d, files, opts)
    if (!opts.hex || opts.verbose) {
      process.stdout.write('\n')
    }
  })

program
  .command('comment [files...]')
  .description('output the commented version of a CBOR item')
  .action(async(files, opts, p) => {
    opts = {...p.parent.opts(), ...opts}
    const c = new Comment({
      callback(er, x) {
        if (er) {
          throw er
        } else {
          process.stdout.write(x)
        }
      },
      verbose: opts.verbose
    })
    opts.newline = false
    await each(c, files, opts)
  })

function main() {
  return program.parseAsync(process.argv)
}
main().catch(e => {
  console.error(e)
  process.exit(1)
})
