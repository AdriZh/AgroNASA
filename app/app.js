/* Fieldwise UI. Depends on window.PRESETS, window.CROPS, window.I18N, window.Engine. */
(function () {
  const $ = id => document.getElementById(id);
  const CROPS = window.CROPS, E = window.Engine, byId = Object.fromEntries(CROPS.map(c => [c.id, c]));
  const DAY = 86400000;
  const LOCAL = {
    akmola: ['spring_wheat', 'barley', 'pea', 'lentil', 'chickpea', 'sunflower', 'canola', 'flax'],
    bambey: ['millet', 'sorghum', 'maize', 'groundnut', 'cowpea'],
    iowa: ['maize', 'soybean', 'spring_wheat', 'barley', 'sorghum', 'pea', 'sunflower'],
  };
  const FAMC = { cereal: 'var(--f-cereal)', legume: 'var(--f-legume)', brassica: 'var(--f-brassica)', aster: 'var(--f-aster)', flax: 'var(--f-flax)' };
  const SCEN = { base: [0, 1], hot: [2, 1], dry: [0, 0.8], both: [2, 0.8] };
  const S = { lang: 'en', raw: null, site: null, pre: null, last: null, prev: null, irr: 'no', soil: 'map', priority: 'safety', canGrow: new Set(), scen: 'base', res: null, sel: 0, step: 1, smClim: null, fc: null };
  try { const l = localStorage.getItem('fieldwise-lang'); if (l && window.I18N[l]) S.lang = l; } catch (e) { /* storage unavailable */ }

  // ---------- text & format ----------
  const t = (k, v = {}) => String(window.I18N[S.lang][k] ?? window.I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
  const loc = () => (S.lang === 'ru' ? 'ru-RU' : 'en-GB');
  const cname = c => c.name[S.lang] || c.name.en;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n0 = v => Math.round(v).toLocaleString(loc());
  const f2 = v => Number(v).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = v => Math.round(v * 100) + '%';
  const mShort = m => new Intl.DateTimeFormat(loc(), { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2001, m, 1)).replace('.', '').slice(0, 3);
  const dm = (m, d) => new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.UTC(2001, m - 1, d));
  const doyDm = doy => { const x = new Date(Date.UTC(2001, 0, 1) + (Math.round(doy) - 1) * DAY); return dm(x.getUTCMonth() + 1, x.getUTCDate()); };
  const ymd = s => new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
  const place = () => (S.raw?.name ? (S.raw.name[S.lang] || S.raw.name.en) : S.raw ? `${S.raw.lat.toFixed(2)}°, ${S.raw.lon.toFixed(2)}°` : '');
  const famDot = c => `<i style="background:${FAMC[c.family]}"></i>`;
  function toast(m) { const el = $('toast'); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 3500); }

  // ---------- tooltip (delegated) ----------
  const tip = $('tip');
  document.addEventListener('pointerover', e => { const el = e.target.closest?.('[data-tip]'); if (!el) return; tip.innerHTML = el.dataset.tip; tip.hidden = false; });
  document.addEventListener('pointermove', e => { if (tip.hidden) return; const w = tip.offsetWidth, vw = document.documentElement.clientWidth; tip.style.left = Math.max(window.scrollX + w / 2 + 8, Math.min(e.pageX, window.scrollX + vw - w / 2 - 8)) + 'px'; tip.style.top = e.pageY + 'px'; });
  document.addEventListener('pointerout', e => { if (e.target.closest?.('[data-tip]')) tip.hidden = true; });

  // ---------- chart primitives ----------
  const W = el => Math.max(280, Math.floor(el.clientWidth || 600));
  function ticks(lo, hi, n) { const st0 = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(st0 || 1))); const st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= st0) || st0; const o = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) o.push(+v.toFixed(6)); return o; }
  function niceTop(max) { const tk = ticks(0, max, 4); const last = tk[tk.length - 1]; return last < max ? last + (tk[1] - tk[0]) : last; }
  const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0);
  const T = (x, y, s, a = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${a.fill || 'var(--muted)'}" font-size="${a.size || 11}" text-anchor="${a.anchor || 'start'}"${a.weight ? ` font-weight="${a.weight}"` : ''}>${esc(s)}</text>`;
  const grid = (x0, x1, y, lbl) => `<line x1="${x0}" x2="${x1}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--grid)"/>` + T(x0 - 6, y + 4, lbl, { anchor: 'end' });
  function topRoundRect(x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h)); return `M${x.toFixed(1)},${(y + h).toFixed(1)}V${(y + r).toFixed(1)}Q${x.toFixed(1)},${y.toFixed(1)} ${(x + r).toFixed(1)},${y.toFixed(1)}H${(x + w - r).toFixed(1)}Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + r).toFixed(1)}V${(y + h).toFixed(1)}Z`; }
  const svgWrap = (w, h, label, s) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${s}</svg>`;

  function chartWaterBalance(el, months) {
    const w = W(el), h = 230, m = { l: 40, r: 8, t: 12, b: 24 };
    const top = niceTop(Math.max(...months.map(v => Math.max(v.rain, v.et0))));
    const y = lin(0, top, h - m.b, m.t), bw = (w - m.l - m.r) / 12;
    let s = ticks(0, top, 4).map(v => grid(m.l, w - m.r, y(v), n0(v))).join('');
    months.forEach((v, i) => {
      s += `<path d="${topRoundRect(m.l + i * bw + bw * 0.18, y(v.rain), bw * 0.64, y(0) - y(v.rain), 4)}" fill="var(--water)" data-tip="<b>${esc(mShort(i))}</b><br>${esc(t('rainLbl'))}: ${n0(v.rain)} mm<br>ET₀: ${n0(v.et0)} mm"/>`;
      s += T(m.l + i * bw + bw / 2, h - 6, mShort(i), { anchor: 'middle' });
    });
    s += `<path d="${months.map((v, i) => (i ? 'L' : 'M') + (m.l + i * bw + bw / 2).toFixed(1) + ',' + y(v.et0).toFixed(1)).join('')}" fill="none" stroke="var(--et)" stroke-width="2" stroke-linejoin="round" pointer-events="none"/>`;
    months.forEach((v, i) => { s += `<circle cx="${(m.l + i * bw + bw / 2).toFixed(1)}" cy="${y(v.et0).toFixed(1)}" r="3" fill="var(--et)" stroke="var(--surface)" stroke-width="1.5" pointer-events="none"/>`; });
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--axis)"/>`;
    el.innerHTML = svgWrap(w, h, t('wbTitle'), s);
  }

  function chartTemp(el, months) {
    const w = W(el), h = 230, m = { l: 36, r: 8, t: 12, b: 24 };
    const lo = Math.min(...months.map(v => v.tmin)), hi = Math.max(...months.map(v => v.tmax));
    const tk = ticks(Math.floor(lo / 10) * 10, Math.ceil(hi / 10) * 10, 5), y = lin(tk[0], tk[tk.length - 1], h - m.b, m.t), bw = (w - m.l - m.r) / 12;
    const X = i => m.l + i * bw + bw / 2;
    let s = tk.map(v => grid(m.l, w - m.r, y(v), v + '°')).join('');
    s += `<path d="${months.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + y(v.tmax).toFixed(1)).join('')}${months.map((_, i) => 'L' + X(11 - i).toFixed(1) + ',' + y(months[11 - i].tmin).toFixed(1)).join('')}Z" fill="var(--temp-band)"/>`;
    if (tk[0] < 0) s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--water)" stroke-width="1.2"/>` + T(w - m.r, y(0) - 4, '0 °C', { anchor: 'end', fill: 'var(--water)' });
    s += `<path d="${months.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + y(v.t).toFixed(1)).join('')}" fill="none" stroke="var(--temp)" stroke-width="2"/>`;
    months.forEach((v, i) => { s += `<rect x="${(m.l + i * bw).toFixed(1)}" y="${m.t}" width="${bw.toFixed(1)}" height="${h - m.t - m.b}" fill="transparent" data-tip="<b>${esc(mShort(i))}</b><br>${esc(t('tMean'))}: ${v.t.toFixed(1)} °C<br>${esc(t('tRange'))}: ${v.tmin.toFixed(1)} … ${v.tmax.toFixed(1)} °C"/>` + T(X(i), h - 6, mShort(i), { anchor: 'middle' }); });
    el.innerHTML = svgWrap(w, h, t('tTitle'), s);
  }

  function soilClim(site) {
    const by = Array.from({ length: 367 }, () => []);
    for (let i = 0; i < site.n; i++) for (let d = -7; d <= 7; d++) { const k = ((site.doy[i] + d - 1 + 366) % 366) + 1; by[k].push(site.w[i]); }
    return by.map(a => { if (!a.length) return null; a.sort((x, y) => x - y); const q = p => a[Math.floor(p * (a.length - 1))]; return [q(0.1), q(0.5), q(0.9)]; });
  }
  function chartSoil(el) {
    const site = S.site, cl = S.smClim, w = W(el), h = 230, m = { l: 40, r: 10, t: 12, b: 24 };
    const n = Math.min(365, site.n), i0 = site.n - n, pts = [];
    for (let i = i0; i < site.n; i++) { let s = 0, k = 0; for (let j = Math.max(0, i - 6); j <= i; j++) { s += site.w[j]; k++; } pts.push({ i, v: s / k, c: cl[site.doy[i]] }); }
    const lo = Math.min(...pts.map(p => Math.min(p.v, p.c[0]))), hi = Math.max(...pts.map(p => Math.max(p.v, p.c[2])));
    const tk = ticks(Math.floor(lo * 10) / 10, Math.ceil(hi * 10) / 10, 4), y = lin(tk[0], tk[tk.length - 1], h - m.b, m.t), x = lin(0, n - 1, m.l, w - m.r);
    const path = f => pts.map((p, k) => (k ? 'L' : 'M') + x(k).toFixed(1) + ',' + y(f(p)).toFixed(1)).join('');
    let s = tk.map(v => grid(m.l, w - m.r, y(v), v.toFixed(1))).join('');
    s += `<path d="${path(p => p.c[2])}${pts.map((_, k) => 'L' + x(n - 1 - k).toFixed(1) + ',' + y(pts[n - 1 - k].c[0]).toFixed(1)).join('')}Z" fill="var(--water-wash)"/>`;
    s += `<path d="${path(p => p.c[1])}" fill="none" stroke="var(--axis)" stroke-width="1.5"/><path d="${path(p => p.v)}" fill="none" stroke="var(--water)" stroke-width="2"/>`;
    s += `<circle cx="${x(n - 1)}" cy="${y(pts[n - 1].v)}" r="4" fill="var(--water)" stroke="var(--surface)" stroke-width="2"/>`;
    for (let k = 0; k < n; k++) { const d = new Date(site.t0 + pts[k].i * DAY); if (d.getUTCDate() === 1 && d.getUTCMonth() % 2 === 0) s += T(x(k), h - 6, mShort(d.getUTCMonth()), { anchor: 'middle' }); }
    const step = Math.max(1, Math.floor(n / 73));
    for (let k = 0; k < n; k += step) { const p = pts[k], d = new Date(site.t0 + p.i * DAY); s += `<rect x="${x(k).toFixed(1)}" y="${m.t}" width="${Math.max(1, x(step) - x(0)).toFixed(1)}" height="${h - m.t - m.b}" fill="transparent" data-tip="<b>${d.toISOString().slice(0, 10)}</b><br>${esc(t('smNow'))}: ${p.v.toFixed(2)}<br>${esc(t('smMed'))}: ${p.c[1].toFixed(2)}"/>`; }
    el.innerHTML = svgWrap(w, h, t('smTitle'), s);
  }

  function chartAnnual(el, clim) {
    const w = W(el), h = 230, m = { l: 40, r: 8, t: 12, b: 24 }, ys = clim.years, r = clim.rains;
    const top = niceTop(Math.max(...r)), y = lin(0, top, h - m.b, m.t), bw = (w - m.l - m.r) / ys.length;
    let s = ticks(0, top, 4).map(v => grid(m.l, w - m.r, y(v), n0(v))).join('');
    ys.forEach((yr, i) => { s += `<path d="${topRoundRect(m.l + i * bw + bw * 0.15, y(r[i]), bw * 0.7, y(0) - y(r[i]), 3)}" fill="var(--water)" opacity="${r[i] === clim.minRain || r[i] === clim.maxRain ? 1 : 0.65}" data-tip="<b>${yr}</b><br>${n0(r[i])} mm"/>`; if (yr % 5 === 0) s += T(m.l + i * bw + bw / 2, h - 6, yr, { anchor: 'middle' }); });
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(clim.annualRain)}" y2="${y(clim.annualRain)}" stroke="var(--ink)" stroke-width="1.5"/>` + `<rect x="${m.l + 4}" y="${(y(clim.annualRain) - 19).toFixed(1)}" width="74" height="16" rx="3" fill="var(--surface)"/>` + T(m.l + 8, y(clim.annualRain) - 7, `${S.lang === 'ru' ? 'среднее' : 'mean'} ${n0(clim.annualRain)} mm`, { fill: 'var(--ink)', weight: 600 });
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--axis)"/>`;
    el.innerHTML = svgWrap(w, h, t('annTitle'), s);
  }

  // ---------- steps ----------
  function go(step) {
    if ((step >= 2 && !S.site) || (step === 3 && !S.res)) return;
    S.step = step;
    [1, 2, 3].forEach(i => { $('s' + i).hidden = i !== step; });
    document.querySelectorAll('.stepper button').forEach(b => { const n = +b.dataset.step; b.setAttribute('aria-current', n === step ? 'step' : 'false'); b.disabled = (n >= 2 && !S.site) || (n === 3 && !S.res); });
    stopSpeech(); window.scrollTo({ top: 0 });
    requestAnimationFrame(drawCharts);
  }
  document.querySelectorAll('.stepper button').forEach(b => b.addEventListener('click', () => go(+b.dataset.step)));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => go(+b.dataset.goto)));

  // ---------- step 1 ----------
  function renderPresets() {
    $('presets').innerHTML = window.PRESETS.map(p => `<button type="button" class="site" data-preset="${p.id}" aria-pressed="${S.raw?.id === p.id}"><b>${esc(p.name[S.lang] || p.name.en)}</b><span class="xs muted mono">${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°</span><span class="xs muted">${(LOCAL[p.id] || []).slice(0, 3).map(id => esc(cname(byId[id]))).join(' · ')}</span></button>`).join('');
    $('presets').querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => loadRaw(window.PRESETS.find(p => p.id === b.dataset.preset))));
  }
  function status1(msg, err) { const el = $('status1'); el.hidden = !msg; el.textContent = msg || ''; el.className = 'status' + (err ? ' err' : ''); }

  function loadRaw(raw) {
    S.raw = raw; S.site = E.buildSite(raw); S.res = null; S.scen = 'base';
    S.smClim = soilClim(S.site);
    $('lat').value = raw.lat.toFixed(2); $('lon').value = raw.lon.toFixed(2);
    S.pre = E.analyse(S.site, CROPS, { lastCrop: raw.lastCrop || CROPS[0].id });
    const local = LOCAL[raw.id] || CROPS.filter(c => S.pre.fit[c.id] !== 'poor').map(c => c.id);
    S.canGrow = new Set(local.length >= 2 ? local : CROPS.map(c => c.id));
    S.last = raw.lastCrop && S.canGrow.has(raw.lastCrop) ? raw.lastCrop : [...S.canGrow][0];
    S.prev = raw.prevCrop && S.canGrow.has(raw.prevCrop) ? raw.prevCrop : S.last;
    S.soil = 'map'; S.irr = 'no';
    status1('');
    renderPresets(); renderStep1(); renderStep2();
    $('to2').disabled = false; go(1);
  }

  async function fetchLive(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 70 || Math.abs(lon) > 180) { status1(t('geoBlocked'), true); return; }
    const btn = $('fetch'); btn.disabled = true; status1(t('loading'));
    const P = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'GWETROOT', 'GWETPROF', 'SNODP', 'ALLSKY_SFC_SW_DWN', 'RH2M', 'WS2M'];
    const SH = { T2M: 't', T2M_MAX: 'tx', T2M_MIN: 'tn', PRECTOTCORR: 'p', GWETROOT: 'w', GWETPROF: 'wp', SNODP: 'sn', ALLSKY_SFC_SW_DWN: 'rs', RH2M: 'rh', WS2M: 'u' };
    const end = new Date(Date.now() - DAY).toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const d = await (await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${P.join(',')}&community=AG&latitude=${lat}&longitude=${lon}&start=20010101&end=${end}&format=JSON`)).json();
      const par = d.properties.parameter, dates = Object.keys(par.T2M).sort();
      const lastValid = Object.fromEntries(P.map(k => [SH[k], [...dates].reverse().find(dt => par[k][dt] !== -999) || null]));
      while (dates.length && P.some(k => par[k][dates[dates.length - 1]] === -999)) dates.pop();
      let filled = 0; const series = {};
      for (const k of P) { let last = 0; series[SH[k]] = dates.map(dt => { let v = par[k][dt]; if (v === -999) { v = last; filled++; } last = v; return v; }); }
      let soil = null;
      try {
        const sg = await (await fetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=clay&property=sand&property=soc&depth=0-5cm&depth=5-15cm&depth=15-30cm&depth=30-60cm&value=mean`)).json();
        soil = {}; for (const L of sg.properties.layers) { const v = L.depths.map(x => x.values.mean).filter(x => x != null).map(x => x / L.unit_measure.d_factor); if (v.length) soil[L.name] = v.reduce((a, b) => a + b, 0) / v.length; }
        if (soil.sand == null) soil = null;
      } catch (e) { soil = null; }
      loadRaw({ id: 'custom', name: null, lat, lon, elev: d.geometry.coordinates[2], start: dates[0], end: dates[dates.length - 1], lastValid, filled, soil, series });
    } catch (e) { status1(t('liveBlocked'), true); } finally { btn.disabled = false; }
  }
  $('fetch').addEventListener('click', () => fetchLive(+$('lat').value, +$('lon').value));
  $('geo').addEventListener('click', () => {
    if (!navigator.geolocation) { status1(t('geoBlocked'), true); return; }
    navigator.geolocation.getCurrentPosition(p => { $('lat').value = p.coords.latitude.toFixed(2); $('lon').value = p.coords.longitude.toFixed(2); fetchLive(+$('lat').value, +$('lon').value); }, () => status1(t('geoBlocked'), true), { timeout: 10000 });
  });

  function renderStep1() {
    const r = S.raw, c = S.pre.clim, lv = r.lastValid || {};
    const vars = ['p', 't', 'w', 'wp', 'sn', 'rs', 'rh', 'u'].filter(k => r.series[k]);
    $('dataPanel').hidden = false;
    $('dataPanel').innerHTML = `<div class="panel-head"><h2>${esc(t('dataTitle'))}</h2><p class="take small">${esc(t('dataHelp'))}</p></div>
      <div class="tbl-wrap"><table><thead><tr><th>NASA POWER</th><th class="num">${S.lang === 'ru' ? 'С' : 'From'}</th><th class="num">${esc(t('availableTo'))}</th></tr></thead><tbody>
      ${vars.map(k => `<tr><td>${esc(t('v_' + k))}</td><td class="num">${ymd(r.start)}</td><td class="num">${ymd(lv[k] || r.end)}</td></tr>`).join('')}
      </tbody></table></div><p class="xs muted">${esc(t('gapsFilled', { n: r.filled || 0 }))}${r.soil ? ' · ISRIC SoilGrids 2.0' : ''}</p>`;
    const sm = c.soilNow, state = sm.z < -0.5 ? t('smDry') : sm.z > 0.5 ? t('smWet') : t('smNormal');
    const fr = c.frost, tr = c.rainTrend;
    $('climPanel').hidden = false;
    $('climPanel').innerHTML = `<div class="panel-head"><h2>${esc(t('climTitle', { place: place() }))}</h2><p class="muted small mono">${c.years[0]}–${c.years[c.years.length - 1]} · ${r.lat.toFixed(2)}°, ${r.lon.toFixed(2)}° · ${n0(r.elev || 0)} m</p></div>
      <div class="cols">
        <div class="stack" style="gap:8px"><h3>${esc(t('wbTitle'))}</h3><p class="take small">${esc(t('wbTake', { rain: n0(c.annualRain), et0: n0(c.months.reduce((a, m) => a + m.et0, 0)), wet: c.months.filter(m => m.rain > m.et0).length }))}</p><div class="legend"><span><i class="sq" style="background:var(--water)"></i>${esc(t('rainLbl'))}, mm</span><span><i class="ln" style="background:var(--et)"></i>${esc(t('et0Lbl'))}, mm</span></div><div class="chart" id="chWB"></div></div>
        <div class="stack" style="gap:8px"><h3>${esc(t('tTitle'))}</h3><p class="take small">${esc(fr ? t('tTakeFrost', { spring: doyDm(fr.lastSpring), autumn: doyDm(fr.firstAutumn), days: Math.round(fr.firstAutumn - fr.lastSpring) }) : t('tTakeNoFrost'))}</p><div class="legend"><span><i class="ln" style="background:var(--temp)"></i>${esc(t('tMean'))}</span><span><i style="background:var(--temp-band)"></i>${esc(t('tRange'))}</span></div><div class="chart" id="chT"></div></div>
        <div class="stack" style="gap:8px"><h3>${esc(t('smTitle'))}</h3><p class="take small">${esc(t('smTake', { state, z: (sm.z >= 0 ? '+' : '') + sm.z.toFixed(1) }))} <span class="muted">${esc(ymd(r.end))}</span></p><div class="legend"><span><i class="ln" style="background:var(--water)"></i>${esc(t('smNow'))}</span><span><i style="background:var(--water-wash)"></i>${esc(t('smBand'))}</span><span><i class="ln" style="background:var(--axis)"></i>${esc(t('smMed'))}</span></div><div class="chart" id="chSM"></div></div>
        <div class="stack" style="gap:8px"><h3>${esc(t('annTitle'))}</h3><p class="take small">${esc(t('annTake', { min: n0(c.minRain), max: n0(c.maxRain), trend: tr.significant ? t('trendSig', { v: (tr.slopePerDecade > 0 ? '+' : '') + n0(tr.slopePerDecade) }) : t('trendNone') }))}</p><div class="chart" id="chAnn"></div></div>
      </div>`;
  }

  // ---------- step 2 ----------
  function renderStep2() {
    if (!S.pre) return;
    const pool = CROPS.filter(c => S.canGrow.has(c.id) || c.id === S.last || c.id === S.prev);
    const opt = sel => pool.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(cname(c))}</option>`).join('');
    const seg = (id, val, items) => `<div class="seg" role="group" id="${id}">${items.map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${val === k}">${esc(l)}</button>`).join('')}</div>`;
    const mapT = S.pre.soil.texture, curSoil = S.soil === 'map' ? mapT : S.soil;
    $('profile').innerHTML = `
      <div class="field"><label for="selLast">${esc(t('lastCrop'))}</label><select id="selLast">${opt(S.last)}</select></div>
      <div class="field"><label for="selPrev">${esc(t('prevCrop'))}</label><select id="selPrev">${opt(S.prev)}</select></div>
      <div class="field"><span class="lbl">${esc(t('irrigation'))}</span>${seg('segIrr', S.irr, [['yes', t('irrYes')], ['no', t('irrNo')], ['unsure', t('irrUnsure')]])}${S.irr === 'unsure' ? `<span class="xs muted">${esc(t('irrUnsureNote'))}</span>` : ''}</div>
      <div class="field"><span class="lbl">${esc(t('soil'))}</span>${seg('segSoil', curSoil, [['sandy', t('sandy')], ['medium', t('medium')], ['clay', t('clay')]])}${S.raw.soil ? `<span class="xs muted">${esc(t('soilFromMap', { t: t(mapT) }))}</span>` : ''}</div>
      <div class="field"><span class="lbl">${esc(t('priority'))}</span>${seg('segPrio', S.priority, [['safety', t('prioSafety')], ['soil', t('prioSoil')], ['income', t('prioIncome')]])}</div>`;
    $('selLast').onchange = e => { S.last = e.target.value; };
    $('selPrev').onchange = e => { S.prev = e.target.value; };
    $('segIrr').querySelectorAll('button').forEach(b => (b.onclick = () => { S.irr = b.dataset.v; renderStep2(); }));
    $('segSoil').querySelectorAll('button').forEach(b => (b.onclick = () => { S.soil = b.dataset.v === mapT && S.raw.soil ? 'map' : b.dataset.v; renderStep2(); }));
    $('segPrio').querySelectorAll('button').forEach(b => (b.onclick = () => { S.priority = b.dataset.v; renderStep2(); }));
    $('canGrow').innerHTML = CROPS.map(c => `<button type="button" class="chip" data-can="${c.id}" aria-pressed="${S.canGrow.has(c.id)}">${famDot(c)}${esc(cname(c))}</button>`).join('');
    $('canGrow').querySelectorAll('[data-can]').forEach(b => (b.onclick = () => { const id = b.dataset.can; if (S.canGrow.has(id)) { if (S.canGrow.size > 2) S.canGrow.delete(id); } else S.canGrow.add(id); renderStep2(); }));
    const rows = [...CROPS].sort((a, b) => (S.pre.evals[b.id]?.median || 0) - (S.pre.evals[a.id]?.median || 0));
    $('suit').innerHTML = `<table><thead><tr><th>${esc(t('colCrop'))}</th><th>${esc(t('colFamily'))}</th><th class="num">${esc(t('colSow'))}</th><th class="num">${esc(t('colOutcome'))}</th><th class="num">${esc(t('colLoss'))}</th><th>${esc(t('colStatus'))}</th></tr></thead><tbody>${rows.map(c => {
      const ev = S.pre.evals[c.id], fit = S.pre.fit[c.id];
      return `<tr${S.canGrow.has(c.id) ? '' : ' style="opacity:.55"'}><td>${esc(cname(c))}</td><td><span class="fam">${famDot(c)}${esc(t('fam_' + c.family))}</span></td><td class="num">${ev ? dm(ev.m, ev.d) : '–'}</td><td class="num"><span class="minibar">${ev ? f2(ev.median) : '–'}<span><i style="width:${ev ? Math.round(ev.median * 100) : 0}%"></i></span></span></td><td class="num">${ev ? pct(ev.bad) : '–'}</td><td><span class="pill ${fit}">${esc(t('status_' + fit))}</span></td></tr>`;
    }).join('')}</tbody></table>`;
  }
  $('to2').addEventListener('click', () => go(2));

  // ---------- step 3 ----------
  function compute() {
    const exclude = new Set(CROPS.filter(c => !S.canGrow.has(c.id) && c.id !== S.last && c.id !== S.prev).map(c => c.id));
    const [dT, rm] = SCEN[S.scen];
    S.res = E.analyse(S.site, CROPS, { lastCrop: S.last, prevCrop: S.prev, irrigated: S.irr === 'yes', priority: S.priority, exclude, soilSrc: S.soil === 'map' ? S.raw.soil : { texture: S.soil }, dT, rainMult: rm });
    S.sel = S.res.plans.findIndex(p => p.recommended);
  }
  $('make').addEventListener('click', () => { $('make').disabled = true; setTimeout(() => { compute(); renderStep3(); $('make').disabled = false; go(3); }, 20); });

  const planName = p => t({ keep: 'planKeep', small: 'planSmall', big: 'planBig' }[p.kind]);
  function planYear(p) { const ev = p.seasons[0].ev, e = S.res.site.end, y = +e.slice(0, 4); return Date.UTC(y, ev.m - 1, ev.d) > Date.UTC(y, +e.slice(4, 6) - 1, +e.slice(6, 8)) ? y : y + 1; }
  const lossShare = p => E.mean(p.seasons.map(s => s.counts.bad / s.counts.n));
  const goodShare = p => E.mean(p.seasons.map(s => s.counts.good / s.counts.n));
  const medOut = p => E.mean(p.seasons.map(s => s.median));
  const seqHtml = p => { const y0 = planYear(p); return `<div class="seq">${p.seasons.map((s, i) => `${i ? '<span class="arr" aria-hidden="true">→</span>' : ''}<span class="s">${famDot(s.crop)}<span>${esc(cname(s.crop))}</span><small>${y0 + i}</small></span>`).join('')}</div>`; };
  function delta(v, b, better, fmt) { const d = v - b; if (Math.abs(d) < 0.005) return `<span class="d flat">± 0</span>`; const good = better === 'up' ? d > 0 : d < 0; return `<span class="d ${good ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}</span>`; }

  function renderStep3() {
    const r = S.res, p = r.plans[S.sel], base = r.plans.find(x => x.kind === 'keep');
    $('rec').innerHTML = `<div class="stack" style="gap:10px"><span class="badge" style="align-self:flex-start">${esc(p.recommended ? t('recTitle') : t('selected'))}</span><h2>${esc(planName(p))}</h2>${seqHtml(p)}<p class="take small">${esc(t('vsBaseline'))}: ${base.seasons.map(s => esc(cname(s.crop))).join(' → ')}</p></div>
      <div class="kpis">
        <div class="kpi"><span class="k">${esc(t('m_outcome'))}</span><span class="v">${f2(medOut(p))}</span>${delta(medOut(p), medOut(base), 'up', f2)}</div>
        <div class="kpi"><span class="k">${esc(t('m_loss'))}</span><span class="v">${pct(lossShare(p))}</span>${delta(lossShare(p), lossShare(base), 'down', v => Math.round(v * 100) + ' pp')}</div>
        <div class="kpi"><span class="k">${esc(t('m_soil'))}</span><span class="v">${Math.round(p.soil * 100)}</span>${delta(p.soil, base.soil, 'up', v => String(Math.round(v * 100)))}</div>
      </div>`;
    $('scen').innerHTML = Object.keys(SCEN).map(k => `<button type="button" data-s="${k}" aria-pressed="${S.scen === k}">${esc(t({ base: 'scenBase', hot: 'scenHot', dry: 'scenDry', both: 'scenBoth' }[k]))}</button>`).join('');
    $('scen').querySelectorAll('button').forEach(b => (b.onclick = () => { S.scen = b.dataset.s; const keep = S.res.plans[S.sel].kind; compute(); const i = S.res.plans.findIndex(x => x.kind === keep); if (i >= 0) S.sel = i; renderStep3(); drawCharts(); }));
    const mb = v => `<span class="minibar">${Math.round(v * 100)}<span><i style="width:${Math.round(v * 100)}%"></i></span></span>`;
    const metrics = [['m_outcome', x => f2(medOut(x))], ['m_good', x => pct(goodShare(x))], ['m_loss', x => pct(lossShare(x))], ['m_soil', x => mb(x.soil)], ['m_income', x => mb(x.income)], ['m_bare', x => x.bareMonths.toFixed(1)]];
    if (r.irrigated) metrics.push(['m_water', x => `${n0(x.waterTypical / 3)} / ${n0(x.waterDry / 3)} mm`]);
    $('cmp').innerHTML = `<table class="cmp"><thead><tr><th></th>${r.plans.map((x, i) => `<th class="plan-h ${i === S.sel ? 'sel' : ''}">${x.recommended ? `<span class="badge">${esc(t('recTitle'))}</span><br>` : ''}${esc(planName(x))}<div class="xs muted" style="font-weight:400;margin:4px 0 8px">${x.seasons.map(s => esc(cname(s.crop))).join(' → ')}</div><button type="button" class="btn" data-sel="${i}" aria-pressed="${i === S.sel}">${esc(i === S.sel ? '✓ ' + t('selected') : t('select'))}</button></th>`).join('')}</tr></thead><tbody>
      ${metrics.map(([k, fn]) => `<tr><td>${esc(t(k))}</td>${r.plans.map((x, i) => `<td class="num ${i === S.sel ? 'sel' : ''}">${fn(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('cmp').querySelectorAll('[data-sel]').forEach(b => (b.onclick = () => { S.sel = +b.dataset.sel; renderStep3(); drawCharts(); }));
    renderForecast(); renderWhy(); renderMethods();
    $('calLegend').innerHTML = `${[...new Set(p.seasons.map(s => s.crop.family))].map(f => `<span><i class="sq" style="background:${FAMC[f]}"></i>${esc(t('fam_' + f))}</span>`).join('')}<span><i style="background:repeating-linear-gradient(135deg,var(--soil) 0 1.5px,var(--soil-wash) 1.5px 5px)"></i>${esc(t('bare'))}</span>${p.seasons.some(s => s.snow.some(Boolean)) ? `<span><i style="background:var(--snow)"></i>${esc(t('snow'))}</span>` : ''}`;
  }

  function chartDist(el) {
    const r = S.res, w = W(el), rowH = 48, m = { l: 132, r: 14, t: 6, b: 26 }, h = m.t + m.b + rowH * r.plans.length;
    const x = lin(0, 1, m.l, w - m.r);
    let s = `<rect x="${x(0)}" y="${m.t}" width="${(x(0.5) - x(0)).toFixed(1)}" height="${h - m.t - m.b}" fill="var(--bad-fill)" opacity="0.07"/>`;
    [0, 0.25, 0.5, 0.75, 1].forEach(v => { s += `<line x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${h - m.b}" stroke="var(--grid)"/>` + T(x(v), h - 8, f2(v), { anchor: 'middle' }); });
    r.plans.forEach((p, k) => {
      const cy = m.t + rowH * k + rowH / 2, maps = p.seasons.map(se => new Map(se.ev.runs.map((run, j) => [run.year, se.yis[j]])));
      const years = [...maps[0].keys()].filter(y => maps.every(mp => mp.has(y)));
      const vals = years.map(y => ({ y, v: E.mean(maps.map(mp => mp.get(y))) }));
      s += T(m.l - 10, cy + 4, planName(p), { anchor: 'end', fill: k === S.sel ? 'var(--ink)' : 'var(--ink-2)', weight: k === S.sel ? 600 : 400, size: 12 });
      vals.forEach((o, j) => { const jy = cy + (((j * 7) % 9) - 4) * 2.4; s += `<circle cx="${x(o.v).toFixed(1)}" cy="${jy.toFixed(1)}" r="4.5" fill="${k === S.sel ? 'var(--brand)' : 'var(--axis)'}" fill-opacity="0.8" stroke="var(--surface)" stroke-width="1" data-tip="<b>${esc(planName(p))}</b><br>${o.y}: ${f2(o.v)}"/>`; });
      const med = E.median(vals.map(o => o.v));
      s += `<line x1="${x(med)}" x2="${x(med)}" y1="${cy - 16}" y2="${cy + 16}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" pointer-events="none"/>`;
    });
    el.innerHTML = svgWrap(w, h, t('distTitle'), s);
  }

  function chartCalendar(el) {
    const p = S.res.plans[S.sel], w = W(el), rowH = 42, m = { l: 46, r: 8, t: 20, b: 6 }, h = m.t + m.b + rowH * 3, y0 = planYear(p);
    const x = lin(0, 365, m.l, w - m.r), doyOf = (mo, d) => (Date.UTC(2001, mo - 1, d) - Date.UTC(2001, 0, 1)) / DAY;
    let s = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--soil-wash)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--soil)" stroke-width="1.2" opacity=".55"/></pattern></defs>`;
    for (let mo = 0; mo < 12; mo++) s += T(x(doyOf(mo + 1, 15)), 12, mShort(mo), { anchor: 'middle' });
    p.seasons.forEach((se, k) => {
      const cy = m.t + k * rowH, yy = cy + 6, hh = rowH - 12;
      s += T(m.l - 8, cy + rowH / 2 + 4, String(y0 + k), { anchor: 'end', fill: 'var(--ink)', weight: 600 });
      for (let mo = 0; mo < 12; mo++) { const xa = x(doyOf(mo + 1, 1)), xb = mo === 11 ? x(365) : x(doyOf(mo + 2, 1)); s += `<rect x="${(xa + 1).toFixed(1)}" y="${yy}" width="${(xb - xa - 2).toFixed(1)}" height="${hh}" rx="3" fill="${se.snow[mo] ? 'var(--snow)' : 'url(#hatch)'}" data-tip="${esc(mShort(mo))} ${y0 + k}: ${esc(se.snow[mo] ? t('snow') : t('bare'))}"/>`; }
      const L = E.seasonLength(se.crop), a = doyOf(se.ev.m, se.ev.d), b = Math.min(365, a + L), hv = new Date(Date.UTC(2001, se.ev.m - 1, se.ev.d) + L * DAY);
      const label = `${cname(se.crop)} · ${dm(se.ev.m, se.ev.d)} – ${dm(hv.getUTCMonth() + 1, hv.getUTCDate())}`;
      s += `<rect x="${x(a).toFixed(1)}" y="${yy - 2}" width="${(x(b) - x(a)).toFixed(1)}" height="${hh + 4}" rx="5" fill="${FAMC[se.crop.family]}" stroke="var(--surface)" stroke-width="2" data-tip="<b>${esc(cname(se.crop))} ${y0 + k}</b><br>${esc(t('sow'))}: ${esc(dm(se.ev.m, se.ev.d))}<br>${esc(t('harvest'))}: ${esc(dm(hv.getUTCMonth() + 1, hv.getUTCDate()))}"/>`;
      const fits = x(b) - x(a) > label.length * 6.3 + 12;
      s += `<text x="${(x(a) + 8).toFixed(1)}" y="${(cy + rowH / 2 + 4).toFixed(1)}" fill="#0b0b0b" font-size="11.5" font-weight="600" pointer-events="none">${esc(fits ? label : cname(se.crop))}</text>`;
    });
    el.innerHTML = svgWrap(w, h, t('calTitle'), s);
  }

  function renderForecast() {
    const r = S.res, p = r.plans[S.sel], se = p.seasons[0];
    const sc = E.scenario(r.site, SCEN[S.scen][0], SCEN[S.scen][1]);
    const o = E.seasonOutlook(r.site, sc, se.crop, se.ev, se.rot.f); S.fc = o;
    const bar = pr => `<div class="probbar">${[['good', 'p-good', 'pGood'], ['ok', 'p-ok', 'pOk'], ['bad', 'p-bad', 'pBad']].map(([k, c, l]) => pr[k] > 0 ? `<span class="${c}" style="flex:${pr[k]}" data-tip="${esc(t(l))}: ${pct(pr[k])}">${pr[k] >= 0.09 ? pct(pr[k]) : ''}</span>` : '').join('')}</div>`;
    const head = o.skilful ? t('fcSkilful', { yhat: f2(o.yhat), clim: f2(o.climMedian), lo: f2(o.range[0]), hi: f2(o.range[1]) }) : t('fcNoSkill');
    const C = o.contrib || [];
    const fmtV = (c, v) => (c.unit === 'mm' ? n0(v) + ' mm' : c.unit === 'cm' ? v.toFixed(1) + ' cm' : v.toFixed(2));
    const formula = C.length ? `ŷ = ${o.intercept.toFixed(3)} ${C.map(c => `${c.beta >= 0 ? '+' : '−'} ${Math.abs(c.beta).toFixed(3)}·z(${c.id})`).join(' ')}` : '';
    $('fcPanel').innerHTML = `<div class="panel-head"><h2>${esc(t('fcTitle'))}</h2><p class="muted small">${esc(t('fcSub', { crop: cname(se.crop), date: dm(o.m, o.d) + ' ' + o.year, issued: ymd(o.issued) }))}</p></div>
      <div class="cols">
        <div class="stack" style="gap:12px">
          <p><b>${esc(head)}</b>${o.skill != null ? ` <span class="muted small mono">skill ${o.skill.toFixed(2)} · r ${o.r.toFixed(2)} · n ${o.n}</span>` : ''}</p>
          <div class="stack" style="gap:6px"><span class="small muted">${esc(t('fcProb'))}</span>
            <div class="probrow"><span>${esc(t('fcForecast'))}</span>${bar(o.probs)}</div>
            <div class="probrow"><span>${esc(t('fcClim'))}</span>${bar(o.climProbs)}</div>
            <div class="legend"><span><i class="sq p-good"></i>${esc(t('pGood'))}</span><span><i class="sq p-ok"></i>${esc(t('pOk'))}</span><span><i class="sq p-bad"></i>${esc(t('pBad'))}</span></div>
          </div>
          ${C.length ? `<div class="stack" style="gap:6px"><span class="small"><b>${esc(t('fcFormula'))}</b>. <span class="muted">${esc(t('fcFormulaHelp', { n: o.n }))}</span></span><div class="formula">${esc(formula)}</div>
          <div class="tbl-wrap"><table><thead><tr><th>${esc(t('colPredictor'))}</th><th class="num">${esc(t('colToday'))}</th><th class="num">${esc(t('colNormal'))}</th><th class="num">${esc(t('colZ'))}</th><th class="num">${esc(t('colEffect'))}</th></tr></thead><tbody>
          ${C.map(c => `<tr><td>${esc(t('p_' + c.id))}</td><td class="num">${fmtV(c, c.now)}</td><td class="num">${fmtV(c, c.normal)}</td><td class="num">${(c.z >= 0 ? '+' : '') + c.z.toFixed(1)}</td><td class="num">${(c.effect >= 0 ? '+' : '−') + Math.abs(c.effect).toFixed(3)}</td></tr>`).join('')}
          </tbody></table></div></div>` : ''}
        </div>
        <div class="stack" style="gap:8px"><h3>${esc(t('fcSkillTitle'))}</h3><p class="take small">${esc(t('fcSkillTake'))}</p><div class="chart" id="chSkill"></div></div>
      </div>
      <p class="xs muted">${esc(t('fcNote'))}</p>`;
  }

  function chartSkill(el) {
    const o = S.fc; if (!o || !el) return;
    const w = W(el), h = 220, m = { l: 40, r: 10, t: 12, b: 36 }, L = [...o.leads].sort((a, b) => b.lead - a.lead);
    const vals = L.map(l => l.skill), lo = Math.min(-0.2, ...vals), hi = Math.max(0.5, ...vals);
    const tk = ticks(Math.floor(lo * 10) / 10, Math.ceil(hi * 10) / 10, 4), y = lin(tk[0], tk[tk.length - 1], h - m.b, m.t), bw = (w - m.l - m.r) / L.length;
    let s = tk.map(v => grid(m.l, w - m.r, y(v), v.toFixed(1))).join('');
    const near = L.reduce((a, b) => (Math.abs(b.lead - o.lead) < Math.abs(a.lead - o.lead) ? b : a));
    L.forEach((l, i) => {
      const x = m.l + i * bw + bw * 0.2, v = l.skill, top = v >= 0 ? y(v) : y(0), hh = Math.max(1, Math.abs(y(v) - y(0))), cur = l === near;
      s += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${hh.toFixed(1)}" rx="3" fill="${v > 0.1 ? 'var(--brand)' : 'var(--axis)'}"${cur ? ' stroke="var(--ink)" stroke-width="2"' : ''} data-tip="${(l.lead / 30.4).toFixed(0)} mo: skill ${v.toFixed(2)}, r = ${l.r.toFixed(2)}"/>`;
      s += T(m.l + i * bw + bw / 2, h - m.b + 14, String(Math.round(l.lead / 30.4)), { anchor: 'middle', weight: cur ? 700 : 400, fill: cur ? 'var(--ink)' : 'var(--muted)' });
    });
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--ink)" stroke-width="1.2"/>` + T((m.l + w - m.r) / 2, h - 4, t('leadMonths'), { anchor: 'middle' });
    el.innerHTML = svgWrap(w, h, t('fcSkillTitle'), s);
  }

  function renderWhy() {
    const r = S.res, p = r.plans[S.sel], base = r.plans.find(x => x.kind === 'keep'), out = [];
    const leg = p.seasons.find(s => s.crop.legume); if (leg) out.push(t('whyLegume', { crop: cname(leg.crop) }));
    if (p.families >= 2) out.push(t('whyBreak', { n: p.families }));
    const rep = p.seasons.find(s => s.rot.why.includes('repeat')); if (rep) out.push(t('whyRepeat', { crop: cname(rep.crop) }));
    if (p !== base) out.push(t('whyRisk', { plan: pct(lossShare(p)), base: pct(lossShare(base)) }));
    const f = p.seasons[0]; out.push(t('whyWater', { crop: cname(f.crop), need: n0(f.ev.medNeed), rain: n0(f.ev.medRain) }));
    if (p.bareMonths >= 1) out.push(t('whyBare', { n: Math.round(p.bareMonths) }));
    $('why').innerHTML = out.map(s => `<li>${esc(s)}</li>`).join('');
  }

  function renderMethods() {
    const r = S.res, assumed = CROPS.filter(c => c.kyAssumed).map(cname).join(', ');
    $('methods').innerHTML = [
      `NASA POWER daily point API, community AG: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT, GWETPROF, SNODP, ALLSKY_SFC_SW_DWN, RH2M, WS2M; ${ymd(S.raw.start)} – ${ymd(S.raw.end)}. Sources: MERRA-2 and CERES (recent days GEOS-IT).`,
      'Reference evapotranspiration: FAO-56 Penman–Monteith. Crop water use: FAO-56 four-stage Kc curves with a daily root-zone water balance.',
      'Outcome index = water factor (FAO-33: 1 − Ky·(1 − ETa/ETc)) × thermal-time factor × heat-at-flowering factor × frost factor. A screening index, not a yield in tonnes.',
      `Soil: ISRIC SoilGrids 2.0 texture and organic carbon, or the user's choice, converted to plant-available water by Saxton & Rawls (2006): ${n0(r.soil.awc)} mm per metre.`,
      'Starting soil water: MERRA-2 root-zone wetness on the sowing day, rescaled by the site’s own 5th–95th percentile range.',
      'Rotation adjustments: +10% after a legume, −10% same family, −15% same crop. Baseline = the farmer’s usual rotation continued.',
      'Next-season outlook: ridge regression (λ = 2) of the outcome index on standardised NASA predictors observed at the same lead time before sowing (root-zone and profile soil moisture, 90-day precipitation, snow depth). Coefficients constrained to the physical sign; validated by leave-one-year-out; skill = 1 − MSE / MSE(climatology). Forecast shown only when skill > 0.1, otherwise the historical distribution.',
      `Ky for ${assumed} is assumed (not in FAO-33) and needs agronomist review. NASA POWER's NEX-GDDP-CMIP6 projection API (beta) returned no values for Kazakhstan or Senegal, so climate change is explored with +2 °C and −20% rain scenarios.`,
    ].map(s => `<li>${esc(s)}</li>`).join('');
  }

  function drawCharts() {
    if (S.step === 1 && S.pre && $('chWB')) { chartWaterBalance($('chWB'), S.pre.clim.months); chartTemp($('chT'), S.pre.clim.months); chartSoil($('chSM')); chartAnnual($('chAnn'), S.pre.clim); }
    if (S.step === 3 && S.res) { chartDist($('chDist')); chartCalendar($('chCal')); chartSkill($('chSkill')); }
  }
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawCharts, 120); });

  // ---------- share & read aloud ----------
  function summary() {
    if (S.step === 3 && S.res) {
      const p = S.res.plans[S.sel], y0 = planYear(p), o = S.fc;
      const lines = [`Fieldwise — ${place()}`, `${planName(p)}: ${p.seasons.map((s, i) => `${y0 + i} ${cname(s.crop)}`).join(', ')}.`];
      p.seasons.forEach((s, k) => { const L = E.seasonLength(s.crop), hv = new Date(Date.UTC(2001, s.ev.m - 1, s.ev.d) + L * DAY); lines.push(`${y0 + k} ${cname(s.crop)}: ${t('sow')} ${dm(s.ev.m, s.ev.d)}, ${t('harvest')} ${dm(hv.getUTCMonth() + 1, hv.getUTCDate())}.`); });
      lines.push(`${t('m_loss')}: ${pct(lossShare(p))}.`);
      if (o) lines.push(o.skilful ? t('fcSkilful', { yhat: f2(o.yhat), clim: f2(o.climMedian), lo: f2(o.range[0]), hi: f2(o.range[1]) }) : t('fcNoSkill'));
      lines.push(t('checkTitle') + ': ' + [t('check1'), t('check2'), t('check3'), t('check4')].join(' '));
      return lines.join('\n');
    }
    if (S.pre) { const c = S.pre.clim; return t('climTitle', { place: place() }) + '. ' + t('wbTake', { rain: n0(c.annualRain), et0: n0(c.months.reduce((a, m) => a + m.et0, 0)), wet: c.months.filter(m => m.rain > m.et0).length }); }
    return t('locHelp');
  }
  $('copy').addEventListener('click', () => { const s = summary(), done = () => toast(t('copied')); try { navigator.clipboard.writeText(s).then(done, () => fb(s, done)); } catch (e) { fb(s, done); } });
  function fb(s, done) { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } ta.remove(); }
  function stopSpeech() { try { speechSynthesis.cancel(); } catch (e) { /* none */ } $('listen').setAttribute('aria-pressed', 'false'); $('listen').querySelector('[data-t]').textContent = t('readAloud'); }
  $('listen').addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return;
    if ($('listen').getAttribute('aria-pressed') === 'true') { stopSpeech(); return; }
    const u = new SpeechSynthesisUtterance(summary().replace(/\n/g, ' ')); u.lang = S.lang === 'ru' ? 'ru-RU' : 'en-US'; u.rate = 0.95; u.onend = stopSpeech;
    $('listen').setAttribute('aria-pressed', 'true'); $('listen').querySelector('[data-t]').textContent = t('stop'); speechSynthesis.speak(u);
  });
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    S.lang = b.dataset.lang; try { localStorage.setItem('fieldwise-lang', S.lang); } catch (e) { /* ignore */ }
    applyStatic(); renderPresets(); if (S.pre) { renderStep1(); renderStep2(); } if (S.res) renderStep3(); drawCharts();
  }));
  function applyStatic() { document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => (el.textContent = t(el.dataset.t))); document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang))); }

  applyStatic(); renderPresets(); loadRaw(window.PRESETS[0]);
})();
