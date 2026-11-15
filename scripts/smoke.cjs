// Playwright smoke test: loads the built site, clicks both demos, opens every tab,
// collects console errors and takes screenshots.
// Usage: node scripts/smoke.cjs [baseUrl] [outDir] [--offline] [--widths=1440x900,390x844]
const { chromium } = require('playwright');
const fs = require('fs');

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const pos = args.filter((a) => !a.startsWith('--'));
const BASE = pos[0] || 'http://localhost:4173/';
const OUT = pos[1] || '.smoke';
const OFFLINE = flags.includes('--offline');
const widthsFlag = flags.find((f) => f.startsWith('--widths='));
const SIZES = (widthsFlag ? widthsFlag.slice(9) : '1440x900').split(',').map((s) => s.split('x').map(Number));
const TABS = ['overview', 'farm', 'resources', 'compare', 'evidence', 'report', 'methods', 'pitch', 'video'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    if (OFFLINE) {
      const origin = new URL(BASE).origin;
      await ctx.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
    }
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${w}] console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${w}] pageerror: ${e.message}`));
    await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${w}-landing.png` });
    for (const demo of [0, 1]) {
      await page.goto(`${BASE}#/overview`).catch(() => {});
      await page.waitForTimeout(800);
      const btns = page.locator('button:has-text("demo")');
      if ((await btns.count()) > demo) { await btns.nth(demo).click(); await page.waitForTimeout(2500); }
      else errors.push(`[${w}] demo button ${demo} not found`);
      for (const t of TABS) {
        await page.goto(`${BASE}#/${t}`).catch(() => {});
        await page.waitForTimeout(t === 'pitch' || t === 'video' ? 2500 : 1500);
        await page.screenshot({ path: `${OUT}/${w}-demo${demo}-${t}.png`, fullPage: t !== 'pitch' && t !== 'video' });
      }
    }
    await ctx.close();
  }
  await browser.close();
  const ignore = (e) => /tile\.openstreetmap|gibs\.earthdata|net::ERR_FAILED|Failed to load resource/.test(e) && OFFLINE;
  const real = errors.filter((e) => !ignore(e));
  fs.writeFileSync(`${OUT}/errors.txt`, errors.join('\n'));
  console.log(`screenshots in ${OUT}; ${errors.length} errors (${real.length} not explained by offline mode)`);
  real.slice(0, 30).forEach((e) => console.log(e));
  process.exit(real.length ? 1 : 0);
})();
