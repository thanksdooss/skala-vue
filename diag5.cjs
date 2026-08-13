const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({width: 960, height: 540});
  await page.setCacheEnabled(false);

  // Go to the full Vue app
  await page.goto('https://skala-vue-marine.vercel.app/', {
    waitUntil: 'networkidle0', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 5000));
  
  // Screenshot LVL 1
  await page.screenshot({path: 'diag5_lvl1.png'});
  
  // Click LVL 2 tab
  const lvl2 = await page.$('div[class*="tab"]:nth-child(3)');
  if (lvl2) { await lvl2.click(); await new Promise(r => setTimeout(r, 3000)); }
  await page.screenshot({path: 'diag5_lvl2.png'});
  
  // Click LVL 3 tab
  const lvl3 = await page.$('div[class*="tab"]:nth-child(4)');
  if (lvl3) { await lvl3.click(); await new Promise(r => setTimeout(r, 3000)); }
  await page.screenshot({path: 'diag5_lvl3.png'});
  
  // Click LVL 4 tab
  const lvl4 = await page.$('div[class*="tab"]:nth-child(5)');
  if (lvl4) { await lvl4.click(); await new Promise(r => setTimeout(r, 3000)); }
  await page.screenshot({path: 'diag5_lvl4.png'});

  await browser.close();
})();
