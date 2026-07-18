/* UX review screenshots of redesign preview */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://mega-events-platform-git-redesign-mega-events.vercel.app';
const OUT = path.join(__dirname, '..', '.ux-review');
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  { name: 'home', url: `${BASE}/` },
  { name: 'artist', url: `${BASE}/artists/7FmlheCQPZGp9qHvYX5lAL` },
  { name: 'order', url: `${BASE}/order/571` },
];

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
      deviceScaleFactor: 2,
      locale: 'he-IL',
    });
    const page = await ctx.newPage();
    for (const p of pages) {
      try {
        await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(2500);
        // full page
        await page.screenshot({ path: path.join(OUT, `${p.name}-${vp.tag}-full.png`), fullPage: true });
        // above the fold
        await page.screenshot({ path: path.join(OUT, `${p.name}-${vp.tag}-fold.png`) });
        // horizontal scroll check
        const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        console.log(`${p.name} ${vp.tag}: hScroll=${hScroll}, scrollW=${await page.evaluate(() => document.documentElement.scrollWidth)}, clientW=${await page.evaluate(() => document.documentElement.clientWidth)}`);
      } catch (e) {
        console.log(`${p.name} ${vp.tag}: ERROR ${e.message}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
})();
