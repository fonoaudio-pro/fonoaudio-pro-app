const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.toString()));
  page.on('requestfailed', req => console.log('REQUEST_FAILED:', req.url(), req.failure()?.errorText));

  const url = 'http://127.0.0.1:4175/';
  console.log('NAVIGATING', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('PAGE LOADED');

  const inputCount = await page.locator('input').count();
  console.log('INPUT COUNT:', inputCount);
  const bodyHTML = await page.evaluate(() => document.body.innerHTML.slice(0, 800));
  console.log('BODY HTML START:', bodyHTML);

  await page.fill('input[type="email"]', 'fonoaudio@clinica.com');
  await page.fill('input[type="password"]', 'FonoProAI2026!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);
  console.log('AFTER LOGIN WAIT');
  try {
    await page.waitForSelector('text=¡Hola,', { timeout: 8000 });
    console.log('Detected dashboard greeting');
  } catch (e) {
    console.log('Dashboard greeting not detected, dumping head/body snippets for inspection');
    const html = await page.content();
    console.log('PAGE CONTENT LENGTH:', html.length);
    console.log('BODY START:', html.slice(0, 2000));
  }
  // Inspect dashboard counters
  const counters = await page.evaluate(() => {
    const findCard = (label) => {
      const els = Array.from(document.querySelectorAll('div'));
      for (const el of els) {
        try {
          if (el.textContent && el.textContent.includes(label)) {
            // find next number-like text
            const nums = el.textContent.match(/\d+/g);
            if (nums && nums.length) return nums[0];
            // try children
            const n = el.querySelector('p')?.textContent?.match(/\d+/g);
            if (n && n.length) return n[0];
          }
        } catch (_) {}
      }
      return null;
    };
    return {
      pacientes: findCard('Pacientes Activos'),
      sesionesHoy: findCard('Sesiones de Hoy'),
      informesPendientes: findCard('Informes Pendientes'),
      alertasFaltantes: findCard('Alertas Faltantes'),
    };
  });

  console.log('DASHBOARD COUNTERS:', counters);
  await browser.close();
})();