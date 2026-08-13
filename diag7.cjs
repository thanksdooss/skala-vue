const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 720});
  await page.setCacheEnabled(false);

  await page.goto('https://skala-vue-marine.vercel.app/vesseljs/examples/vessel_simulation.html', {
    waitUntil: 'networkidle0', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 3000));
  
  // Enable REFERENCE by sending postMessage
  await page.evaluate(() => {
    window.postMessage({ type: 'TOGGLE_GHOST', show: true }, '*');
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({path: 'diag7_ghost_on.png'});

  await browser.close();
})();
