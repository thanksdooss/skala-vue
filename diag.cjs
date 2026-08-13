const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 720});

  const errors = [];
  const warnings = [];
  const failed = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' || text.includes('Error')) errors.push(text);
    else if (msg.type() === 'warning' || text.includes('warn')) warnings.push(text);
  });
  page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));
  page.on('requestfailed', req => failed.push(req.url() + ' -> ' + (req.failure()?.errorText || 'unknown')));

  await page.goto('https://skala-vue-marine.vercel.app/vesseljs/examples/vessel_simulation.html', {
    waitUntil: 'networkidle0', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({path: 'diag_screenshot.png'});

  console.log('\n=== FAILED REQUESTS (' + failed.length + ') ===');
  failed.forEach(f => console.log(f));
  console.log('\n=== ERRORS (' + errors.length + ') ===');
  errors.slice(0, 30).forEach(e => console.log(e));
  console.log('\n=== WARNINGS (' + warnings.length + ') ===');
  warnings.slice(0, 10).forEach(w => console.log(w));

  await browser.close();
})();
