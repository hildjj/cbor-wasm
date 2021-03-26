import fs from 'fs'
import child_process from 'child_process'

const dirname = new URL('.', import.meta.url)

function exec(cmd, args) {
  return new Promise((resolve, reject) => {
    const result = {
      errors: -1,
      skipped: -1,
      total: -1,
      fail: false
    }
    const child = child_process.spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'inherit'],
      cwd: dirname.pathname
    })
      .on('error', reject)
      .on('exit', code => {
        if (code !== 0) {
          console.error(`FAIL ${args} code:${code}`)
          result.fail = true
        }
        resolve(result)
      })
    child.stdout.on('data', data => {
      const m = data.toString().match(/^(\d+)\.\.(\d+)\.\.(\d+)$/m)
      if (m) {
        result.errors = parseInt(m[1], 10)
        result.skipped = parseInt(m[2], 10)
        result.total = parseInt(m[3], 10)
      }
      process.stdout.write(data)
    })
  })
}

async function main() {
  const tests = (await fs.promises.readdir(dirname))
    .filter(n => n.match(/^test_.*?\.mjs/))
  const [cmd] = process.argv
  const args = [
    ...process.execArgv,
    ...process.argv.slice(1, -1)
  ]
  let errors = 0
  let skipped = 0
  let total = 0
  let fail = false
  for (const test of tests) {
    const {pathname} = new URL(test, import.meta.url)
    const res = await exec(cmd, [...args, pathname])
    if (res.errors === -1) {
      console.error(`FAIL.  No tests in "${test}"`)
      fail = true
      continue
    }
    errors += res.errors
    skipped += res.skipped
    total += res.total
    if (res.fail) {
      fail = true
    }
  }
  console.log(`
${errors}..${skipped}..${total}
# overall
# tests: ${total}
# pass: ${total - errors - skipped}
# skipped: ${skipped}
# fail: ${errors}
  `)
  if (fail) {
    process.exit(1)
  }
}

main().catch(er => {
  console.error(er)
  process.exit(1)
})
