const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 720});
  await page.setCacheEnabled(false);

  const errors = [];
  const stlErrors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.text().includes('Error loading STL')) stlErrors.push(msg.text());
  });

  await page.goto('https://skala-vue-marine.vercel.app/vesseljs/examples/vessel_simulation.html', {
    waitUntil: 'networkidle0', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({path: 'diag3_screenshot.png'});

  const groupErrors = errors.filter(e => e.includes("'group'") || e.includes('"group"'));
  console.log('Total page errors:', errors.length);
  console.log('Group errors:', groupErrors.length);
  console.log('STL fallback warnings:', stlErrors.length);
  if (errors.length > 0) {
    console.log('\n--- First 5 errors ---');
    errors.slice(0, 5).forEach(e => console.log(e));
  }

  await browser.close();
})();
