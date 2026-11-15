// Playwright smoke test: loads the built site, clicks both demos, opens every tab,
// collects console errors and takes screenshots.
// Also: a custom (non-bundled) farm must settle to a plan or a clear error, and the landing first-load file list is recorded.
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
  // A browser always logs "Failed to load resource" when a third-party API answers 4xx/5xx or is unreachable
  // (rate limits, gaps in a NASA record, blocked network). Those are upstream conditions the app handles with
  // fallbacks; they are listed separately. App errors, page errors and same-origin failures still fail the run.
  const upstream = [];
  const ORIGIN = new URL(BASE).origin;
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    if (OFFLINE) {
      const origin = new URL(BASE).origin;
      await ctx.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
    }
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const url = m.location()?.url || '';
      if (/^Failed to load resource/.test(m.text()) && url && !url.startsWith(ORIGIN)) upstream.push(`[${w}] ${m.text()} <- ${url.slice(0, 140)}`);
      else errors.push(`[${w}] console: ${m.text()}${url ? ` <- ${url.slice(0, 140)}` : ''}`);
    });
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
    // Custom farm (not bundled): must reach a plan or a clear error with a retry, never a stuck spinner.
    await page.goto(`${BASE}#/overview`).catch(() => {});
    await page.waitForTimeout(800);
    const preset = page.locator('button.preset:has-text("Kano")');
    if (await preset.count()) {
      await preset.first().click();
      await page.waitForTimeout(2000); // route chunk + first request
      const settled = await page.waitForFunction(() => !document.querySelector('.loading-banner'), null, { timeout: OFFLINE ? 15000 : 60000 }).then(() => true, () => false);
      if (!settled) errors.push(`[${w}] custom farm: NASA POWER spinner still showing`);
      await page.waitForTimeout(OFFLINE ? 500 : 15000); // online: give SoilGrids its timeout
      await page.screenshot({ path: `${OUT}/${w}-custom-compare.png`, fullPage: true });
      const side = await page.locator('.side-status').innerText().catch(() => '');
      fs.writeFileSync(`${OUT}/${w}-custom-status.txt`, side);
      if (/unavailable/i.test(side)) errors.push(`[${w}] custom farm: sidebar says "unavailable": ${side.replace(/\s+/g, ' ')}`);
      for (const t of ['farm', 'evidence']) {
        await page.goto(`${BASE}#/${t}`).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/${w}-custom-${t}.png`, fullPage: true });
      }
      for (const tab of ['Field', 'Forecast']) {
        const b = page.locator(`[role="tab"]:has-text("${tab}")`);
        if (!(await b.count())) continue;
        await b.first().click();
        await page.waitForTimeout(OFFLINE ? 1500 : 12000);
        await page.screenshot({ path: `${OUT}/${w}-custom-evidence-${tab.split(' ')[0].toLowerCase()}.png`, fullPage: true });
      }
    } else errors.push(`[${w}] preset "Kano" not found`);
    await ctx.close();
    // First load: which same-origin files the landing route downloads (sizes are computed from dist/).
    const ctx2 = await browser.newContext({ viewport: { width: w, height: h } });
    if (OFFLINE) {
      const origin = new URL(BASE).origin;
      await ctx2.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
    }
    const p2 = await ctx2.newPage();
    const files = [];
    p2.on('response', (r) => { if (r.url().startsWith(new URL(BASE).origin)) files.push(new URL(r.url()).pathname); });
    const t0 = Date.now();
    await p2.goto(BASE, { waitUntil: 'load' }).catch(() => {});
    await p2.waitForSelector('.recharts-surface', { timeout: 15000 }).catch(() => errors.push(`[${w}] landing: no chart within 15 s`));
    fs.writeFileSync(`${OUT}/${w}-first-load.txt`, `chart visible after ${Date.now() - t0} ms\n${[...new Set(files)].join('\n')}\n`);
    await ctx2.close();
  }
  await browser.close();
  const ignore = (e) => /tile\.openstreetmap|gibs\.earthdata|net::ERR_FAILED|Failed to load resource/.test(e) && OFFLINE;
  const real = errors.filter((e) => !ignore(e));
  fs.writeFileSync(`${OUT}/errors.txt`, errors.join('\n'));
  fs.writeFileSync(`${OUT}/upstream.txt`, upstream.join('\n'));
  console.log(`screenshots in ${OUT}; ${errors.length} errors (${real.length} not explained by offline mode); ${upstream.length} third-party request failures handled by fallbacks (see upstream.txt)`);
  real.slice(0, 30).forEach((e) => console.log(e));
  process.exit(real.length ? 1 : 0);
})();
