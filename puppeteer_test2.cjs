const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  await page.setBypassServiceWorker(true);
  await page.setCacheEnabled(false);
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  
  try {
    await page.goto('https://skala-vue-marine.vercel.app/vesseljs/examples/vessel_simulation.html', {waitUntil: 'networkidle0'});
  } catch (e) {
    console.error("Navigation error:", e);
  }
  await browser.close();
})();
