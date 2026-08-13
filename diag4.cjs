const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({width: 1920, height: 1080});
  await page.setCacheEnabled(false);

  await page.goto('https://skala-vue-marine.vercel.app/', {
    waitUntil: 'networkidle0', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({path: 'diag4_full_app.png'});

  await browser.close();
})();
