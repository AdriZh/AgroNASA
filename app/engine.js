/* Fieldwise engine — pure functions, no UI. Works in the browser (window.Engine) and in Node (module.exports).
   Methods: FAO-56 Penman-Monteith reference ET, FAO-56 daily soil-water bucket with Kc curves,
   FAO-33 yield response (Ky), Saxton & Rawls (2006) soil water, Theil-Sen trend + Mann-Kendall test.
   Output is a screening estimate of water- and temperature-limited yield, not a yield forecast. */
(function (root) {
  const DAY = 86400000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
  const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;

  // ---------- soil ----------
  function saxton(sandPct, clayPct, omPct) {
    const S = sandPct / 100, C = clayPct / 100, OM = Math.min(omPct, 8);
    const t1500 = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031;
    const wp = t1500 + (0.14 * t1500 - 0.02);
    const t33 = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299;
    const fc = t33 + (1.283 * t33 * t33 - 0.374 * t33 - 0.015);
    const ts33 = 0.278 * S + 0.034 * C + 0.022 * OM - 0.018 * S * OM - 0.027 * C * OM - 0.584 * S * C + 0.078;
    const sat = fc + (ts33 + (0.636 * ts33 - 0.107)) - 0.097 * S + 0.043;
    return { fc, wp, sat: Math.max(sat, fc + 0.05), awc: Math.max(fc - wp, 0.04) * 1000 };
  }
  const TEXTURES = { sandy: { sand: 80, clay: 8 }, medium: { sand: 40, clay: 20 }, clay: { sand: 20, clay: 45 } };
  function soilFrom(src) {
    // src: {sand, clay, soc(g/kg)} from SoilGrids, or {texture:'sandy'|'medium'|'clay'}
    let sand, clay, om;
    if (src && src.texture) { ({ sand, clay } = TEXTURES[src.texture]); om = 2; }
    else if (src && src.sand != null) { sand = src.sand; clay = src.clay; om = clamp((src.soc || 12) * 1.724 / 10, 0.5, 8); }
    else { ({ sand, clay } = TEXTURES.medium); om = 2; }
    const texture = sand >= 65 ? 'sandy' : clay >= 35 ? 'clay' : 'medium';
    return { ...saxton(sand, clay, om), sand, clay, texture };
  }

  // ---------- weather ----------
  function parseYMD(s) { return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)); }
  function et0Series(site, tShift) {
    const n = site.n, out = new Float32Array(n), z = site.elev || 0, phi = site.lat * Math.PI / 180;
    const P = 101.3 * Math.pow((293 - 0.0065 * z) / 293, 5.26), gamma = 0.000665 * P;
    const e0 = T => 0.6108 * Math.exp(17.27 * T / (T + 237.3));
    for (let i = 0; i < n; i++) {
      const t = site.t[i] + tShift, tx = site.tx[i] + tShift, tn = site.tn[i] + tShift;
      const J = site.doy[i];
      const dr = 1 + 0.033 * Math.cos(2 * Math.PI * J / 365), dec = 0.409 * Math.sin(2 * Math.PI * J / 365 - 1.39);
      const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(dec), -1, 1));
      const ra = 24 * 60 / Math.PI * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
      const rs = Math.max(site.rs[i], 0), rso = (0.75 + 2e-5 * z) * ra;
      const ratio = rso > 0 ? clamp(rs / rso, 0.25, 1) : 0.5;
      const es = (e0(tx) + e0(tn)) / 2, ea = Math.max(site.rh[i] / 100 * e0(site.t[i]), 0); // humidity keeps today's vapour (absolute) content
      const delta = 4098 * e0(t) / Math.pow(t + 237.3, 2);
      const rnl = 4.903e-9 * (Math.pow(tx + 273.16, 4) + Math.pow(tn + 273.16, 4)) / 2 * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * ratio - 0.35);
      const rn = 0.77 * rs - rnl, u = site.u[i];
      out[i] = Math.max(0, (0.408 * delta * rn + gamma * 900 / (t + 273) * u * Math.max(es - ea, 0)) / (delta + gamma * (1 + 0.34 * u)));
    }
    return out;
  }

  /** raw: {lat, lon, elev, start:'YYYYMMDD', series:{t,tx,tn,p,w,rs,rh,u}, soil} */
  function buildSite(raw) {
    const s = raw.series, n = s.t.length, t0 = parseYMD(raw.start);
    const site = { id: raw.id, name: raw.name, lat: raw.lat, lon: raw.lon, elev: raw.elev, t0, n, end: raw.end, soilRaw: raw.soil,
      t: s.t, tx: s.tx, tn: s.tn, p: s.p, w: s.w, wp: s.wp, sn: s.sn, rs: s.rs, rh: s.rh, u: s.u, doy: new Int16Array(n), month: new Int8Array(n), year: new Int16Array(n), _scen: {} };
    for (let i = 0; i < n; i++) {
      const d = new Date(t0 + i * DAY);
      site.year[i] = d.getUTCFullYear(); site.month[i] = d.getUTCMonth();
      site.doy[i] = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1;
    }
    site.firstYear = site.year[0];
    site.lastFullYear = site.month[n - 1] === 11 && new Date(t0 + (n - 1) * DAY).getUTCDate() === 31 ? site.year[n - 1] : site.year[n - 1] - 1;
    // wetness climatology by day of year (for "today vs normal")
    const wsum = new Float64Array(367), wcnt = new Float64Array(367);
    for (let i = 0; i < n; i++) { wsum[site.doy[i]] += s.w[i]; wcnt[site.doy[i]]++; }
    site.wClim = Array.from(wsum, (v, j) => wcnt[j] ? v / wcnt[j] : NaN);
    const ws = Array.from(s.w).sort((a, b) => a - b);
    site.wLo = ws[Math.floor(n * 0.05)]; site.wHi = ws[Math.floor(n * 0.95)];
    return site;
  }

  function scenario(site, dT = 0, rainMult = 1) {
    const key = dT + '|' + rainMult;
    if (!site._scen[key]) {
      const p = rainMult === 1 ? site.p : Float32Array.from(site.p, v => v * rainMult);
      site._scen[key] = { dT, rainMult, p, et0: et0Series(site, dT) };
    }
    return site._scen[key];
  }

  function dayIndex(site, y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - site.t0) / DAY); }

  // ---------- crop season ----------
  const kcCache = new Map();
  function kcCurve(c) {
    if (kcCache.has(c.id)) return kcCache.get(c.id);
    const [i, d, m, l] = c.stages, [ki, km, ke] = c.kc, k = [];
    for (let j = 0; j < i; j++) k.push(ki);
    for (let j = 0; j < d; j++) k.push(ki + (km - ki) * (j + 1) / d);
    for (let j = 0; j < m; j++) k.push(km);
    for (let j = 0; j < l; j++) k.push(km + (ke - km) * (j + 1) / l);
    kcCache.set(c.id, k); return k;
  }
  const seasonLength = c => c.stages.reduce((a, b) => a + b, 0);

  /** Run one season from day index i0. Returns water/temperature-limited yield index 0..1 and diagnostics. */
  function runSeason(site, sc, soil, crop, i0, w0) {
    const kc = kcCurve(crop), L = kc.length;
    if (i0 < 0 || i0 + L > site.n) return null;
    const taw = soil.awc * crop.root, raw = crop.p * taw;
    const wStart = w0 != null ? w0 : site.w[i0];
    // MERRA-2 root-zone wetness is rescaled by this site's own range (5th..95th percentile) to 0..1 of available water
    const rel = clamp((wStart - site.wLo) / Math.max(site.wHi - site.wLo, 1e-3), 0, 1);
    let dr = taw * (1 - rel), etc = 0, eta = 0, rain = 0, stress = 0, gdd = 0, hot = 0, frostHit = false;
    const midStart = crop.stages[0] + crop.stages[1], midEnd = midStart + Math.min(20, crop.stages[2]); // flowering window
    for (let k = 0; k < L; k++) {
      const i = i0 + k, e = kc[k] * sc.et0[i], P = sc.p[i];
      const ks = dr <= raw ? 1 : Math.max(0, (taw - dr) / (taw - raw));
      if (ks < 1) stress++;
      const a = ks * e;
      dr = clamp(dr - P + a, 0, taw);
      etc += e; eta += a; rain += P;
      const T = site.t[i] + sc.dT;
      gdd += Math.max(0, Math.min(T, 30) - crop.tbase);
      if (k >= midStart && k < midEnd && site.tx[i] + sc.dT > crop.heat) hot++;
      if (k > 10 && site.tn[i] + sc.dT < crop.frost) frostHit = true;
    }
    const water = etc > 0 ? clamp(1 - crop.ky * (1 - eta / etc), 0, 1) : 1;
    const growth = clamp(gdd / crop.gdd, 0, 1);
    const heatF = clamp(1 - 0.03 * hot, 0.5, 1);
    const frostF = frostHit ? 0.4 : 1;
    return { yi: water * growth * heatF * frostF, water, growth, heatF, frostHit, hot, rain, etc, eta, stress, days: L };
  }

  function seasonYears(site, crop, m, d) {
    const L = seasonLength(crop), ys = [];
    for (let y = site.firstYear; y <= site.year[site.n - 1]; y++) {
      const i0 = dayIndex(site, y, m, d);
      if (i0 >= 0 && i0 + L <= site.n) ys.push(y);
    }
    return ys;
  }

  function classify(yi) { return yi >= 0.75 ? 'good' : yi >= 0.5 ? 'ok' : 'bad'; }

  function evalCropAt(site, sc, soil, crop, m, d) {
    const years = seasonYears(site, crop, m, d), runs = [];
    for (const y of years) { const r = runSeason(site, sc, soil, crop, dayIndex(site, y, m, d)); if (r) runs.push({ year: y, ...r }); }
    const yis = runs.map(r => r.yi);
    return { m, d, runs, median: median(yis), bad: runs.filter(r => r.yi < 0.5).length / runs.length,
      counts: { good: runs.filter(r => r.yi >= 0.75).length, ok: runs.filter(r => r.yi >= 0.5 && r.yi < 0.75).length, bad: runs.filter(r => r.yi < 0.5).length },
      frostYears: runs.filter(r => r.frostHit).length, medRain: median(runs.map(r => r.rain)), medNeed: median(runs.map(r => r.etc)) };
  }

  /** Mean air temperature climatology for a 10-day window starting on (m,d). */
  function climT(site, sc, m, d) {
    const v = [];
    for (let y = site.firstYear; y <= site.year[site.n - 1]; y++) {
      const i0 = dayIndex(site, y, m, d);
      if (i0 < 0 || i0 + 10 > site.n) continue;
      for (let k = 0; k < 10; k++) v.push(site.t[i0 + k] + sc.dT);
    }
    return mean(v);
  }

  /** Search sowing dates (1st and 15th of each month) and keep the one with the best median outcome. */
  function bestSowing(site, sc, soil, crop) {
    let best = null;
    for (let m = 1; m <= 12; m++) for (const d of [1, 15]) {
      if (climT(site, sc, m, d) < crop.tsow) continue;
      const r = evalCropAt(site, sc, soil, crop, m, d);
      if (!r.runs.length) continue;
      const s = r.median - 0.5 * r.bad;
      if (!best || s > best._s) best = { ...r, _s: s };
    }
    return best;
  }

  function fitOf(ev) {
    if (!ev) return 'poor';
    if (ev.median >= 0.7 && ev.bad <= 0.15) return 'good';
    if (ev.median < 0.45 || ev.bad > 0.45) return 'poor';
    return 'risky';
  }

  // ---------- climate facts for the farmer ----------
  function theilSen(y) {
    const n = y.length, sl = [];
    let s = 0;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) { sl.push((y[j] - y[i]) / (j - i)); s += Math.sign(y[j] - y[i]); }
    const v = n * (n - 1) * (2 * n + 5) / 18, z = s === 0 ? 0 : (s - Math.sign(s)) / Math.sqrt(v);
    const p = erfc(Math.abs(z) / Math.SQRT2);
    return { slopePerDecade: median(sl) * 10, p, significant: p < 0.05 };
  }
  function erfc(x) { // Abramowitz-Stegun 7.1.26
    const t = 1 / (1 + 0.3275911 * x);
    return t * Math.exp(-x * x) * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  }

  function climate(site, sc) {
    const y0 = site.firstYear, y1 = site.lastFullYear, ny = y1 - y0 + 1;
    const P = Array(12).fill(0), E = Array(12).fill(0), T = Array(12).fill(0), Tn = Array(12).fill(0), Tx = Array(12).fill(0), cnt = Array(12).fill(0);
    const yearly = {};
    for (let i = 0; i < site.n; i++) {
      const y = site.year[i]; if (y > y1) break;
      const m = site.month[i];
      P[m] += sc.p[i]; E[m] += sc.et0[i]; T[m] += site.t[i] + sc.dT; Tn[m] += site.tn[i] + sc.dT; Tx[m] += site.tx[i] + sc.dT; cnt[m]++;
      const Y = yearly[y] || (yearly[y] = { rain: 0, lastFrost: 0, firstFrost: 366, hot: 0, tSummer: 0, nSummer: 0 });
      Y.rain += sc.p[i];
      const tn = site.tn[i] + sc.dT, tx = site.tx[i] + sc.dT, doy = site.doy[i];
      const north = site.lat >= 0, summer = north ? (m >= 5 && m <= 7) : (m === 11 || m <= 1);
      if (tn < 0) { if ((north && doy < 182) || (!north && doy >= 182)) Y.lastFrost = Math.max(Y.lastFrost, doy); else Y.firstFrost = Math.min(Y.firstFrost, doy); }
      if (summer) { Y.tSummer += site.t[i] + sc.dT; Y.nSummer++; if (tx >= 30) Y.hot++; }
    }
    const months = P.map((_, m) => ({ rain: P[m] / ny, et0: E[m] / ny, t: T[m] / cnt[m], tmin: Tn[m] / cnt[m], tmax: Tx[m] / cnt[m] }));
    const ys = Object.keys(yearly).map(Number).sort();
    const rains = ys.map(y => yearly[y].rain);
    const frostYears = ys.filter(y => yearly[y].lastFrost > 0);
    const wetMonths = months.map((v, i) => [i, v.rain]).sort((a, b) => b[1] - a[1]);
    const summerT = ys.map(y => yearly[y].tSummer / Math.max(1, yearly[y].nSummer));
    // soil wetness now vs normal (last 30 days)
    let now = 0, norm = 0, k = 0;
    for (let i = site.n - 30; i < site.n; i++) { if (i < 0) continue; now += site.w[i]; norm += site.wClim[site.doy[i]]; k++; }
    const anomaly = k ? (now - norm) / k : 0;
    // standard deviation of 30-day means around this date in past years, for an anomaly in SD units
    const endDoy = site.doy[site.n - 1], past = [];
    for (let y = site.firstYear; y < site.year[site.n - 1]; y++) { const i = dayIndex(site, y, 1, 1) + endDoy - 1; if (i >= 29 && i < site.n) past.push(winMean(site.w, i, 30)); }
    const sdPast = Math.sqrt(mean(past.map(v => (v - mean(past)) ** 2))) || 0.01;
    const zNow = k ? (now / k - mean(past)) / sdPast : 0;
    return {
      months, years: ys, rains,
      annualRain: mean(rains), driestYear: ys[rains.indexOf(Math.min(...rains))], wettestYear: ys[rains.indexOf(Math.max(...rains))],
      minRain: Math.min(...rains), maxRain: Math.max(...rains),
      wettest3: wetMonths.slice(0, 3).map(x => x[0]).sort((a, b) => a - b),
      frost: frostYears.length > ny / 2 ? { lastSpring: median(frostYears.map(y => yearly[y].lastFrost)), firstAutumn: median(frostYears.map(y => yearly[y].firstFrost).filter(v => v < 366)) } : null,
      hotDays: median(ys.map(y => yearly[y].hot)),
      summerTrend: theilSen(summerT), rainTrend: theilSen(rains),
      soilNow: { anomaly, z: zNow, now: k ? now / k : NaN, normal: k ? norm / k : NaN, asOf: site.end },
    };
  }


  // ---------- statistical outlook: ridge regression on NASA pre-season predictors, leave-one-out validated ----------
  function solve(A, b) { // Gauss-Jordan for small systems
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c] || 1e-12;
      for (let k = c; k <= n; k++) M[c][k] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map(r => r[n]);
  }
  function ridgeFit(X, y, lambda) {
    const n = X.length, k = X[0].length;
    const mu = Array.from({ length: k }, (_, j) => mean(X.map(r => r[j])));
    const sd = Array.from({ length: k }, (_, j) => Math.sqrt(mean(X.map(r => (r[j] - mu[j]) ** 2))) || 1);
    const Z = X.map(r => r.map((v, j) => (v - mu[j]) / sd[j])), ym = mean(y);
    const A = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => Z.reduce((s, r) => s + r[a] * r[b], 0) + (a === b ? lambda : 0)));
    const rhs = Array.from({ length: k }, (_, a) => Z.reduce((s, r, i) => s + r[a] * (y[i] - ym), 0));
    const beta = solve(A, rhs);
    return { mu, sd, ym, beta, predict: x => ym + x.reduce((s, v, j) => s + beta[j] * (v - mu[j]) / sd[j], 0) };
  }
  const PRED = [
    { id: 'rootSM', unit: '', get: (site, i) => winMean(site.w, i, 30) },
    { id: 'profileSM', unit: '', get: (site, i) => winMean(site.wp, i, 30) },
    { id: 'rain90', unit: 'mm', get: (site, i, sc) => winSum(sc.p, i, 90) },
    { id: 'snow', unit: 'cm', get: (site, i) => winMean(site.sn, i, 30), needsSnow: true },
  ];
  function winMean(a, i, n) { let s = 0, k = 0; for (let j = Math.max(0, i - n + 1); j <= i; j++) { s += a[j]; k++; } return k ? s / k : NaN; }
  function winSum(a, i, n) { let s = 0; for (let j = Math.max(0, i - n + 1); j <= i; j++) s += a[j]; return s; }

  /** Build a lead-specific model: predict the season outcome from NASA predictors observed `lead` days before sowing. */
  function outlookModel(site, sc, runs, m, d, lead, rotF) {
    const hasSnow = site.sn && Math.max(...site.sn) > 2;
    let preds = PRED.filter(p => (p.id !== 'profileSM' || site.wp) && (!p.needsSnow || hasSnow));
    const lambda = 2;
    const build = ps => runs.map(r => { const i = dayIndex(site, r.year, m, d) - lead; return i < 90 ? null : { year: r.year, x: ps.map(p => p.get(site, i, sc)), y: Math.min(1, r.yi * rotF) }; }).filter(Boolean);
    // Physical sign constraint: more water (soil moisture, snow, rain) must not lower a water-limited outcome.
    // Drop any predictor whose fitted effect is negative, then refit.
    let rows = build(preds);
    if (rows.length < 12) return null;
    for (let it = 0; it < preds.length; it++) {
      const f = ridgeFit(rows.map(r => r.x), rows.map(r => r.y), lambda);
      const keep = preds.filter((_, j) => f.beta[j] > 0);
      if (keep.length === preds.length || !keep.length) break;
      preds = keep; rows = build(preds);
    }
    const loo = rows.map((row, j) => { const tr = rows.filter((_, k) => k !== j); const f = ridgeFit(tr.map(r => r.x), tr.map(r => r.y), lambda); return { pred: f.predict(row.x), clim: mean(tr.map(r => r.y)), obs: row.y }; });
    const mseCv = mean(loo.map(o => (o.pred - o.obs) ** 2)), mseCl = mean(loo.map(o => (o.clim - o.obs) ** 2));
    const po = loo.map(o => o.pred), ob = loo.map(o => o.obs), mp = mean(po), mo = mean(ob);
    const r = po.reduce((s, v, i) => s + (v - mp) * (ob[i] - mo), 0) / Math.sqrt(po.reduce((s, v) => s + (v - mp) ** 2, 0) * ob.reduce((s, v) => s + (v - mo) ** 2, 0) || 1);
    const fit = ridgeFit(rows.map(r => r.x), rows.map(r => r.y), lambda);
    return { lead, preds, fit, rows, skill: 1 - mseCv / mseCl, r, residuals: loo.map(o => o.obs - o.pred), n: rows.length };
  }

  /** Outlook for the next sowing of `crop`, issued on the latest NASA day. */
  function seasonOutlook(site, sc, crop, ev, rotF) {
    const lastIdx = site.n - 1, lastDate = new Date(site.t0 + lastIdx * DAY);
    let year = lastDate.getUTCFullYear();
    if (dayIndex(site, year, ev.m, ev.d) <= lastIdx) year++;
    const lead = dayIndex(site, year, ev.m, ev.d) - lastIdx;
    const model = outlookModel(site, sc, ev.runs, ev.m, ev.d, lead, rotF);
    const clim = ev.runs.map(r => Math.min(1, r.yi * rotF));
    const leads = [240, 180, 150, 120, 90, 60, 30, 0].map(L => { const mo = outlookModel(site, sc, ev.runs, ev.m, ev.d, L, rotF); return mo ? { lead: L, skill: mo.skill, r: mo.r } : null; }).filter(Boolean);
    const probs = vals => ({ good: vals.filter(v => v >= 0.75).length / vals.length, ok: vals.filter(v => v >= 0.5 && v < 0.75).length / vals.length, bad: vals.filter(v => v < 0.5).length / vals.length });
    const base = { crop, year, m: ev.m, d: ev.d, lead, issued: site.end, leads, climProbs: probs(clim), climMedian: median(clim) };
    if (!model) return { ...base, skilful: false, probs: probs(clim) };
    // clamp today's predictors to ±2 SD of the training years so the line is not extrapolated far outside the record
    const xNow = model.preds.map((p, j) => clamp(p.get(site, lastIdx, sc), model.fit.mu[j] - 2 * model.fit.sd[j], model.fit.mu[j] + 2 * model.fit.sd[j]));
    const xRaw = model.preds.map(p => p.get(site, lastIdx, sc));
    const yhat = clamp(model.fit.predict(xNow), 0, 1);
    const skilful = model.skill > 0.1;
    const ens = skilful ? model.residuals.map(e => clamp(yhat + e, 0, 1)) : clim;
    const q = a => { const v = [...a].sort((x, y) => x - y); return [v[Math.floor(0.1 * (v.length - 1))], v[Math.round(0.9 * (v.length - 1))]]; };
    const contrib = model.preds.map((p, j) => ({ id: p.id, unit: p.unit, now: xRaw[j], normal: model.fit.mu[j], z: (xNow[j] - model.fit.mu[j]) / model.fit.sd[j], beta: model.fit.beta[j], effect: model.fit.beta[j] * (xNow[j] - model.fit.mu[j]) / model.fit.sd[j] }));
    return { ...base, skilful, skill: model.skill, r: model.r, n: model.n, yhat: skilful ? yhat : median(clim), range: q(ens), probs: probs(ens), intercept: model.fit.ym, contrib };
  }

  // ---------- rotations ----------
  const ROT = { afterLegume: 1.10, sameFamily: 0.90, sameCropTwice: 0.85 };
  function rotationMultiplier(prev, cur) {
    if (!prev) return { f: 1, why: [] };
    let f = 1; const why = [];
    if (prev.id === cur.id) { f *= ROT.sameCropTwice; why.push('repeat'); }
    else if (prev.family === cur.family) { f *= ROT.sameFamily; why.push('sameFamily'); }
    if (prev.legume && !cur.legume) { f *= ROT.afterLegume; why.push('afterLegume'); }
    return { f, why };
  }

  function coveredMonths(ev, crop) {
    const set = new Set(), L = seasonLength(crop);
    for (let k = 0; k < L; k += 5) set.add(new Date(Date.UTC(2001, ev.m - 1, ev.d) + k * DAY).getUTCMonth());
    return set;
  }

  /** Evaluate a 3-season plan. evals: {cropId: bestSowing result}. irrigated: water shortage is topped up, and the water needed is reported. */
  function evalPlan(seq, last, evals, cropsById, clim, irrigated) {
    let prev = cropsById[last];
    const pct = (a, q) => { const v = [...a].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(q * v.length))]; };
    const seasons = seq.map(id => {
      const c = cropsById[id], ev = evals[id], rm = rotationMultiplier(prev, c);
      const base = r => (irrigated ? r.growth * r.heatF * (r.frostHit ? 0.4 : 1) : r.yi);
      const yis = ev.runs.map(r => Math.min(1, base(r) * rm.f));
      const need = ev.runs.map(r => Math.max(0, r.etc - r.eta));
      prev = c;
      const cover = coveredMonths(ev, c);
      const snow = clim.months.map((v, i) => v.t < -2 && !cover.has(i));
      const bare = clim.months.map((v, i) => !cover.has(i) && !snow[i]);
      return { id, crop: c, ev, rot: rm, yis, median: median(yis), bad: yis.filter(v => v < 0.5).length / yis.length,
        counts: { good: yis.filter(v => v >= 0.75).length, ok: yis.filter(v => v >= 0.5 && v < 0.75).length, bad: yis.filter(v => v < 0.5).length, n: yis.length },
        water: { typical: median(need), dry: pct(need, 0.8) }, cover: [...cover], bare, snow };
    });
    const fams = new Set(seq.map(id => cropsById[id].family)).size;
    const legumes = seq.filter(id => cropsById[id].legume).length;
    const bareMonths = mean(seasons.map(s => s.bare.filter(Boolean).length));
    const repeats = seasons.filter(s => s.rot.why.includes('repeat')).length;
    const waterTypical = seasons.reduce((a, s) => a + s.water.typical, 0), waterDry = seasons.reduce((a, s) => a + s.water.dry, 0);
    let safety = clamp(1 - mean(seasons.map(s => s.bad)) * 1.6, 0, 1);
    if (irrigated) safety *= 1 - Math.min(0.4, waterTypical / 2000); // needing lots of irrigation water is itself a risk and a cost
    const soil = clamp(0.4 * Math.min(1, legumes) + 0.35 * (fams - 1) / 2 + 0.25 * (1 - bareMonths / 9) - 0.15 * repeats, 0, 1);
    const income = clamp(mean(seasons.map(s => s.median * s.crop.value / 3)) / 0.8, 0, 1);
    return { seq, seasons, safety, soil, income, families: fams, legumes, bareMonths, waterTypical, waterDry, irrigated: !!irrigated };
  }

  const WEIGHTS = { safety: { safety: 0.6, soil: 0.2, income: 0.2 }, soil: { safety: 0.25, soil: 0.55, income: 0.2 }, income: { safety: 0.25, soil: 0.15, income: 0.6 } };
  const planScore = (p, pri) => { const w = WEIGHTS[pri] || WEIGHTS.safety; return w.safety * p.safety + w.soil * p.soil + w.income * p.income; };

  /** Main entry: returns everything the UI needs. opts: {lastCrop, prevCrop, irrigated, priority, exclude:Set, soilSrc, dT, rainMult} */
  function analyse(site, crops, opts) {
    const sc = scenario(site, opts.dT || 0, opts.rainMult || 1);
    const soil = soilFrom(opts.soilSrc || site.soilRaw);
    const cropsById = Object.fromEntries(crops.map(c => [c.id, c]));
    const evals = {}, fit = {};
    for (const c of crops) { evals[c.id] = bestSowing(site, sc, soil, c); fit[c.id] = fitOf(evals[c.id]); }
    const clim = climate(site, sc);
    const last = opts.lastCrop && evals[opts.lastCrop] ? opts.lastCrop : crops.find(c => evals[c.id])?.id;
    const allowed = crops.filter(c => evals[c.id] && !(opts.exclude && opts.exclude.has(c.id)));
    const usable = allowed.filter(c => fit[c.id] !== 'poor');
    const pri = opts.priority || 'safety';

    const plans = [], irr = !!opts.irrigated;
    const EP = seq => evalPlan(seq, last, evals, cropsById, clim, irr);
    // A: keep as now — continue the farmer's usual pattern (two-crop rotation, or the same crop every year)
    const prevC = opts.prevCrop && evals[opts.prevCrop] ? opts.prevCrop : last;
    const keepSeq = prevC !== last ? [prevC, last, prevC] : [last, last, last];
    plans.push({ kind: 'keep', ...EP(keepSeq) });
    // B: small change — swap the middle season of the usual pattern for a break crop
    const keepFams = new Set(keepSeq.map(id => cropsById[id].family)), keepHasLegume = keepSeq.some(id => cropsById[id].legume);
    const breakPool = usable.filter(c => !keepFams.has(c.family) && (keepHasLegume ? !c.legume : c.legume));
    const breakPool2 = breakPool.length ? breakPool : usable.filter(c => !keepFams.has(c.family));
    let bestB = null;
    for (const c of breakPool2) { const p = EP([keepSeq[0], c.id, keepSeq[2]]); if (!bestB || planScore(p, pri) > planScore(bestB, pri)) bestB = p; }
    if (bestB) plans.push({ kind: 'small', ...bestB });
    // C: best 3-crop sequence with at least two families, different from A and B
    let bestC = null;
    const pool = usable.length >= 2 ? usable : allowed;
    for (const a of pool) for (const b of pool) for (const c of pool) {
      if (a.id === b.id || b.id === c.id) continue;
      const seq = [a.id, b.id, c.id];
      if ((bestB && seq.join() === bestB.seq.join()) || seq.join() === keepSeq.join()) continue;
      const p = EP(seq);
      if (p.families < 2) continue;
      if (!bestC || planScore(p, pri) > planScore(bestC, pri)) bestC = p;
    }
    if (bestC) plans.push({ kind: 'big', ...bestC });
    plans.forEach(p => { p.score = planScore(p, pri); });
    const recommended = plans.reduce((a, b) => (b.score > a.score ? b : a));
    recommended.recommended = true;

    // Next-season outlook: first season of the recommended plan, started from today's soil-moisture anomaly
    const first = recommended.seasons[0], ev = first.ev;
    const doy = Math.floor((Date.UTC(2001, ev.m - 1, ev.d) - Date.UTC(2001, 0, 1)) / DAY) + 1;
    const w0 = clamp(site.wClim[doy] + 0.5 * clim.soilNow.anomaly, 0.02, 1);
    const outlookRuns = ev.runs.map(r => runSeason(site, sc, soil, first.crop, dayIndex(site, r.year, ev.m, ev.d), w0)).filter(Boolean);
    const oy = outlookRuns.map(r => Math.min(1, r.yi * first.rot.f));
    const outlook = { crop: first.crop, m: ev.m, d: ev.d, n: oy.length,
      good: oy.filter(v => v >= 0.75).length, ok: oy.filter(v => v >= 0.5 && v < 0.75).length, bad: oy.filter(v => v < 0.5).length, anomaly: clim.soilNow.anomaly };

    return { site, soil, clim, evals, fit, plans, recommended, outlook, last, prev: prevC, irrigated: irr, priority: pri, scenario: { dT: sc.dT, rainMult: sc.rainMult } };
  }

  const api = { seasonOutlook, outlookModel, buildSite, analyse, soilFrom, scenario, runSeason, bestSowing, evalCropAt, climate, classify, seasonLength, theilSen, ROT, median, mean };
  root.Engine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
