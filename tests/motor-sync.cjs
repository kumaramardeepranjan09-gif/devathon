const { chromium } = require('playwright');
const fs = require('node:fs'), http = require('node:http'), assert = require('node:assert/strict');
const server = http.createServer((req, res) => res.end(fs.readFileSync('demo.html')));
(async () => {
  await new Promise(resolve => server.listen(8098, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8098');
    await page.waitForFunction(() => online);
    await page.locator('#pickMotor2').click();
    await page.locator('[data-command="M2S"]').click();
    await page.waitForFunction(() => !busy && data.m2 === 'STOP');
    assert.equal(await page.evaluate(() => data.r2), false);
    await page.locator('#numericSpeed2').fill('0');
    await page.locator('#numericSpeed2').press('Tab');
    await page.waitForFunction(() => !busy && data.sp2 === 0);
    await page.locator('[data-command="M2F"]').click();
    assert.match(await page.locator('#message').textContent(), /PWM is 0/);
    assert.equal(await page.evaluate(() => data.m2), 'STOP');
    assert.equal(await page.evaluate(() => views[1].running), false);
    await page.locator('#numericSpeed2').fill('150');
    await page.locator('#numericSpeed2').press('Tab');
    await page.waitForFunction(() => !busy && data.sp2 === 150);
    await page.locator('[data-command="M2F"]').click();
    await page.waitForFunction(() => !busy && data.m2 === 'FORWARD');
    await page.evaluate(async () => { sim.movement_detected = false; await update(); });
    assert.equal(await page.evaluate(() => views[1].running), true);
    await page.locator('[data-command="M2R"]').click();
    await page.waitForFunction(() => !busy && data.m2 === 'REVERSE');
    assert.equal(await page.evaluate(() => views[1].direction), -1);
    await page.locator('[data-command="M2S"]').click();
    await page.waitForFunction(() => !busy && !views[1].running);
    assert.equal(await page.evaluate(() => views[0].running), true);
    await page.evaluate(() => {
      const v = views[1];
      v.set({...data, sequence: data.sequence + 1, r2: true, m2: 'FORWARD'}, true);
      v.lastTelemetry = performance.now() - 5000;
      v.set({...data, sequence: v.sequence, r2: true, m2: 'FORWARD'}, true);
    });
    assert.equal(await page.evaluate(() => views[1].running), false);
    await page.locator('#workspaceStop').click();
    await page.waitForFunction(() => !busy && views.every(v => !v.running));
    console.log('PASS Motor 2 start/reverse/stop, zero-PWM recovery, independent animation without shared movement, stale rejection, ALL STOP');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
