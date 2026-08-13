const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 720});
  await page.setCacheEnabled(false);

  await page.goto('https://skala-vue-marine.vercel.app/vesseljs/examples/vessel_simulation.html', {
    waitUntil: 'networkidle0', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({path: 'diag6_hull_fix.png'});

  await browser.close();
})();
