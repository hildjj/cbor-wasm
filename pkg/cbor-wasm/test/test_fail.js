import {TestParser, Runner} from './utils.js'
import assert from 'assert'
import util from 'util'
import fs from 'fs'

async function main() {
  const parser = new TestParser()
  const runner = new Runner()

  const fail = new URL('../../../test-vectors/fail.json', import.meta.url)
  let vectors = []
  try {
    const txt = await fs.promises.readFile(fail, 'utf8')
    vectors = JSON.parse(txt)
  } catch (e) {
    console.log(`Run "git submodule update --init"
    ${util.inspect(e).replace(/\n/g, '\n    ')}`)
    process.exit(1)
  }

  for (const {hex} of vectors) {
    runner.run(() => {
      assert(parser.parse_fail(hex), hex)
    }, hex)
  }

  runner.summary()
}

main().catch(console.error)
