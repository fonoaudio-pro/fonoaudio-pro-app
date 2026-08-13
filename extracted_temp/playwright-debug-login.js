const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.toString()));
  page.on('requestfailed', req => console.log('REQUEST_FAILED:', req.url(), req.failure()?.errorText));

  const url = 'http://127.0.0.1:4175/';
  console.log('NAVIGATING', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  console.log('PAGE LOADED');

  await page.fill('input[type="email"]', 'fonoaudio@clinica.com');
  await page.fill('input[type="password"]', 'FonoProAI2026!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);
  console.log('AFTER LOGIN WAIT');
  const html = await page.content();
  console.log('PAGE CONTENT LENGTH:', html.length);
  await browser.close();
})();