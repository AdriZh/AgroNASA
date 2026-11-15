// Frame-accurate capture of the 30-second film: node scripts/render-video.cjs <baseUrl> <outDir> [fps] [onlyTimes]
// Requires Playwright + Chromium. Frames are PNGs named f00000.png …; encode with scripts/encode-video.sh.
const { chromium } = require('playwright');
const fs = require('fs');
const [base = 'http://localhost:4173/', out = 'frames', fpsArg = '30', only] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
  const browser = await chromium.launch({ proxy });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${base}#/video-render?t=0`);
  await page.waitForFunction(() => window.__fsReady === true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const fps = Number(fpsArg);
  const times = only ? only.split(',').map(Number) : Array.from({ length: 30 * fps }, (_, i) => i / fps);
  let n = 0;
  for (const t of times) {
    await page.evaluate((v) => window.__setT(v), t);
    await page.screenshot({ path: `${out}/${only ? `t${t}` : `f${String(n).padStart(5, '0')}`}.png`, type: 'png' });
    n++;
    if (n % 60 === 0) process.stdout.write(`${n}/${times.length}\n`);
  }
  await browser.close();
})();
