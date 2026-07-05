/* Order flow walkthrough: tickets -> flights -> hotel, screenshots each step */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://mega-events-platform-git-redesign-mega-events.vercel.app';
const OUT = path.join(__dirname, '..', '.ux-review');
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { tag: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  { tag: 'desktop', width: 1440, height: 900 },
];

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `flow-${name}.png`) });
  console.log(`shot: flow-${name}`);
}

async function shotSlices(page, name, max = 6) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const h = page.viewportSize().height;
  const n = Math.min(Math.ceil(total / h), max);
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * h);
    await page.waitForTimeout(700);
    await shot(page, `${name}-s${i}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

(async () => {
  const browser = await chromium.launch();
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch,
      deviceScaleFactor: 1.5,
      locale: 'he-IL',
    });
    const page = await ctx.newPage();
    const t = vp.tag;
    try {
      await page.goto(`${BASE}/order/571`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2500);
      await shotSlices(page, `${t}-step1-tickets`, 5);

      // proceed to flights: bottom bar CTA
      const cta1 = page.locator('button:has-text("לבחירת טיסה"), a:has-text("לבחירת טיסה")').first();
      await cta1.click({ timeout: 10000 });
      console.log(`${t}: clicked to flights, waiting...`);
      await page.waitForTimeout(1500);
      await shot(page, `${t}-step2-loading`);
      // wait for flight results (airline rows) up to 45s
      await page.waitForTimeout(20000);
      await shotSlices(page, `${t}-step2-flights`, 5);

      // proceed to hotel
      const cta2 = page.locator('button:has-text("לבחירת מלון"), a:has-text("לבחירת מלון")').first();
      await cta2.click({ timeout: 10000 });
      console.log(`${t}: clicked to hotels, waiting...`);
      await page.waitForTimeout(20000);
      await shotSlices(page, `${t}-step3-hotels`, 5);

      // proceed to review
      const cta3 = page.locator('button:has-text("לסיום"), button:has-text("לסיכום"), button:has-text("המשך"), a:has-text("לסיום")').first();
      try {
        await cta3.click({ timeout: 8000 });
        await page.waitForTimeout(8000);
        await shotSlices(page, `${t}-step4-review`, 5);
      } catch (e) {
        console.log(`${t}: review step CTA not found: ${e.message.split('\n')[0]}`);
      }
    } catch (e) {
      console.log(`${t}: FLOW ERROR ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
