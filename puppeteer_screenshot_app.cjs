const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  await page.setViewport({width: 1920, height: 1080});
  await page.setBypassServiceWorker(true);
  await page.setCacheEnabled(false);
  
  try {
    await page.goto('https://skala-vue-marine.vercel.app/', {waitUntil: 'networkidle0'});
    await new Promise(r => setTimeout(r, 4000)); // wait a bit for rendering
    await page.screenshot({path: 'skala_app_screenshot.png'});
  } catch (e) {
    console.error("Navigation error:", e);
  }
  await browser.close();
})();
