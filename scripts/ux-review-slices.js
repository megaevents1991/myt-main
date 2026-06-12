/* Slice screenshots: scroll through each page, capture viewport-sized slices */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://mega-events-platform-git-redesign-mega-events.vercel.app';
const OUT = path.join(__dirname, '..', '.ux-review');
fs.mkdirSync(OUT, { recursive: true });

const targets = process.argv[2] ? process.argv[2].split(',') : ['home', 'artist'];
const pagesAll = {
  home: `${BASE}/`,
  artist: `${BASE}/artists/7FmlheCQPZGp9qHvYX5lAL`,
  order: `${BASE}/order/571`,
};

const viewports = [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
];

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
    for (const name of targets) {
      const url = pagesAll[name];
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const h = vp.height;
      const slices = Math.min(Math.ceil(total / h), 14);
      for (let i = 0; i < slices; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), i * h);
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(OUT, `${name}-${vp.tag}-s${String(i).padStart(2, '0')}.png`) });
      }
      console.log(`${name} ${vp.tag}: ${slices} slices of ${total}px`);
    }
    await ctx.close();
  }
  await browser.close();
})();
