const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 720});
  await page.setCacheEnabled(false);

  const errors = [];
  page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));

  // Use the specific deployment URL, not the alias (to avoid CDN cache)
  await page.goto('https://skala-vue-marine-8a9kmx9jm-thanksdooss.vercel.app/vesseljs/examples/vessel_simulation.html', {
    waitUntil: 'networkidle0', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({path: 'diag2_screenshot.png'});

  const groupErrors = errors.filter(e => e.includes("'group'"));
  console.log('Total errors:', errors.length);
  console.log('Group errors:', groupErrors.length);
  console.log('Sample errors:', errors.slice(0, 5).join('\n'));

  await browser.close();
})();
