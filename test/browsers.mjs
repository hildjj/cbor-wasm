import playwright from 'playwright'
import assert from 'assert'
import child_process from 'child_process'

function startServer() {
  return new Promise((resolve, reject) => {
    const {pathname} = new URL('..', import.meta.url)
    const child = child_process.spawn(
      'npx',
      [ 'light-server', '-p', '4001', '-q', '-s', pathname ],
      { stdio: ['inherit', 'pipe', 'inherit'] }
    )
      .on('error', reject)
    child.stdout.on('data', data => {
      process.stdout.write(data)
      const m = data.toString().match(/listening at (https?:\/\/[0-9.:]+)/)
      if (m) {
        resolve({url: m[1], child})
      } else {
        console.log(`no match: "${data.toString()}"`)
      }
    })
  })
}

async function main() {
  const {url, child} = await startServer()
  try {
    for (const kind of ['chromium', 'webkit', 'firefox']) {
      process.stdout.write(`${kind} ... `)
      const browser = await playwright[kind].launch({
        headless: true
      })
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto(new URL('/example/', url).href)
      await page.click('input[type="text"]')

      // Press a with modifiers
      await page.press('input[type="text"]', 'Meta+a')
      await page.fill('input[type="text"]', '816162')

      // Click text=decode
      await page.click('text=decode')

      const decoded = await page.$eval('#result', r => r.innerText)
      assert.deepEqual(decoded, '[ \'b\' ]')

      // ---------------------
      await context.close()
      await browser.close()
      process.stdout.write('done\n')
    }
  } finally {
    child.kill('SIGINT')
  }
}

main().catch(console.error)
