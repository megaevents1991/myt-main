/* Verify fixes on local dev: stepper one-line, hardened greens, hero logo */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:3013';
const OUT = path.join(__dirname, '..', '.ux-review');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  // mobile
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1.5,
    locale: 'he-IL',
  });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/order/571`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'verify-mobile-step1.png') });
  // stepper single-line check
  const stepperOk = await page.evaluate(() => {
    const steps = document.querySelectorAll('.mantine-Stepper-step');
    if (!steps.length) return 'no stepper';
    const tops = new Set([...steps].map((s) => Math.round(s.getBoundingClientRect().top)));
    return tops.size === 1 ? 'ONE LINE' : `WRAPPED (${tops.size} rows)`;
  });
  console.log('stepper:', stepperOk);

  // flights step
  await page.locator('button:has-text("לבחירת טיסה")').first().click();
  await page.waitForTimeout(22000);
  await page.screenshot({ path: path.join(OUT, 'verify-mobile-step2.png') });
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'verify-mobile-step2b.png') });
  await ctx.close();

  // desktop home hero (logo animation present) + flights desktop
  const dctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    locale: 'he-IL',
  });
  const dpage = await dctx.newPage();
  await dpage.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 120000 });
  await dpage.waitForTimeout(2000);
  await dpage.screenshot({ path: path.join(OUT, 'verify-desktop-home.png') });
  await dpage.goto(`${BASE}/order/571`, { waitUntil: 'networkidle', timeout: 120000 });
  await dpage.waitForTimeout(2000);
  await dpage.locator('button:has-text("לבחירת טיסה")').first().click();
  await dpage.waitForTimeout(22000);
  await dpage.screenshot({ path: path.join(OUT, 'verify-desktop-step2.png') });
  await dctx.close();
  await browser.close();
})();
