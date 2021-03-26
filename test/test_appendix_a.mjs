import {TestParser, Runner} from './utils.mjs'
import assert from 'assert'
import util from 'util'
import fs from 'fs'

async function main() {
  const parser = new TestParser()
  await parser.init()
  const runner = new Runner()

  const appendix_a = new URL('../test-vectors/appendix_a.json', import.meta.url)
  let vectors = []
  try {
    let txt = await fs.promises.readFile(appendix_a, 'utf8')
    // HACK: don't lose data when JSON parsing
    txt = txt.replace(/"decoded":\s*(-?\d+(\.\d+)?(e[+-]\d+)?)\n/g,
      `"decoded": {
        "___TYPE___": "number",
        "___VALUE___": "$1"
      }
`)
    vectors = JSON.parse(txt, (key, value) => {
      if (!value) {
        return value
      }
      switch (value['___TYPE___']) {
        case 'number': {
          const v = value['___VALUE___']
          if (/^-?\d+$/.test(v)) {
            const b = BigInt(v)
            if (b > 0) {
              return (b <= Number.MAX_SAFE_INTEGER) ? Number(b) : b
            }
            return (b >= Number.MIN_SAFE_INTEGER) ? Number(b) : b
          }
          return Number.parseFloat(v)
        }
        default:
          return value
      }
    })
  } catch (e) {
    console.log(`Run "git submodule update --init"
    ${util.inspect(e).replace(/\n/g, '\n    ')}`)
    process.exit(1)
  }

  for (const {hex, decoded, diagnostic} of vectors) {
    if (decoded != null) {
      runner.run(() => {
        assert.deepEqual(
          parser.parse(hex),
          decoded,
          hex
        )
      }, hex)
    }
    if (diagnostic != null) {
      runner.run(() => {
        assert.deepEqual(
          util.inspect(parser.parse(hex), {colors: false, depth: Infinity}),
          diagnostic,
          hex
        )
      },
      hex,
      [
        // real diagnose
        'c074323031332d30332d32315432303a30343a30305a',
        'd74401020304',
        'd818456449455446',
        'd82076687474703a2f2f7777772e6578616d706c652e636f6d',
        '40',
        '4401020304',
        'a201020304',
        '5f42010243030405ff'
      ].includes(hex))
    }
  }

  runner.summary()
}

main().catch(console.error)
