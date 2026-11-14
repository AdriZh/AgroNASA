/* Fieldwise UI. Depends on window.PRESETS, window.CROPS, window.I18N, window.Engine. */
(function () {
  const $ = id => document.getElementById(id);
  const CROPS = window.CROPS, E = window.Engine, byId = Object.fromEntries(CROPS.map(c => [c.id, c]));
  const LOCAL = {
    akmola: ['spring_wheat', 'barley', 'pea', 'lentil', 'chickpea', 'sunflower', 'canola', 'flax'],
    bambey: ['millet', 'sorghum', 'maize', 'groundnut', 'cowpea'],
    iowa: ['maize', 'soybean', 'spring_wheat', 'barley', 'sorghum', 'pea', 'sunflower'],
  };
  const PRESET_ICON = { akmola: '🌾', bambey: '🥜', iowa: '🌽' };
  const S = { lang: 'en', raw: null, site: null, pre: null, lastCrop: null, canGrow: new Set(), soil: 'map', priority: 'safety', res: null, sel: 0, dT: 0, rainMult: 1, step: 1 };
  try { const l = localStorage.getItem('fieldwise-lang'); if (l && window.I18N[l]) S.lang = l; } catch (e) { /* storage unavailable */ }

  // ---------- text helpers ----------
  const t = (k, v = {}) => (window.I18N[S.lang][k] ?? window.I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
  const cname = c => (c.name[S.lang] || c.name.en);
  const locale = () => (S.lang === 'ru' ? 'ru-RU' : 'en-GB');
  const monthShort = m => new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2001, m, 1)).replace('.', '');
  const monthLong = m => new Intl.DateTimeFormat(locale(), { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2001, m, 1));
  const dayMonth = (m, d) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(Date.UTC(2001, m - 1, d));
  const doyDate = doy => { const dt = new Date(Date.UTC(2001, 0, 1) + (Math.round(doy) - 1) * 86400000); return dayMonth(dt.getUTCMonth() + 1, dt.getUTCDate()); };
  const ymd = s => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
  const n0 = v => Math.round(v).toLocaleString(locale());
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const placeName = () => S.raw ? (S.raw.name ? (S.raw.name[S.lang] || S.raw.name.en) : `${S.raw.lat.toFixed(2)}, ${S.raw.lon.toFixed(2)}`) : '';
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 4000); }

  function applyStatic() {
    document.documentElement.lang = S.lang;
    document.querySelectorAll('[data-t]').forEach(el => (el.textContent = t(el.dataset.t)));
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
  }

  // ---------- steps ----------
  function go(step) {
    if (step >= 2 && !S.site) return;
    if (step === 3 && !S.res) return;
    S.step = step;
    [1, 2, 3].forEach(i => { $('s' + i).hidden = i !== step; });
    document.querySelectorAll('.steps button').forEach(b => {
      const n = +b.dataset.step;
      b.setAttribute('aria-current', n === step ? 'step' : 'false');
      b.disabled = (n >= 2 && !S.site) || (n === 3 && !S.res);
    });
    stopSpeech();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.steps button').forEach(b => b.addEventListener('click', () => go(+b.dataset.step)));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => go(+b.dataset.goto)));

  // ---------- step 1: location ----------
  function renderPresets() {
    $('presets').innerHTML = window.PRESETS.map(p => {
      const crops = (LOCAL[p.id] || []).slice(0, 3).map(id => byId[id].icon).join(' ');
      const on = S.raw && S.raw.id === p.id;
      return `<button type="button" class="choice" data-preset="${p.id}" aria-pressed="${on}"><span class="ico" aria-hidden="true">${PRESET_ICON[p.id] || '📍'}</span><span><b>${esc(p.name[S.lang] || p.name.en)}</b><small>${t('example')} · ${crops}</small></span><span class="tick" aria-hidden="true">${on ? '✓' : ''}</span></button>`;
    }).join('');
    $('presets').querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => loadRaw(window.PRESETS.find(p => p.id === b.dataset.preset))));
  }

  function status1(msg, kind) { const el = $('status1'); el.hidden = !msg; el.textContent = msg || ''; el.className = 'status' + (kind ? ' ' + kind : ''); }

  function loadRaw(raw) {
    S.raw = raw; S.site = E.buildSite(raw); S.res = null; S.dT = 0; S.rainMult = 1;
    $('lat').value = raw.lat.toFixed(2); $('lon').value = raw.lon.toFixed(2);
    // first pass: which crops fit this place (used for step 2 chips)
    S.pre = E.analyse(S.site, CROPS, { lastCrop: raw.lastCrop || 'spring_wheat', priority: S.priority });
    const local = LOCAL[raw.id] || CROPS.filter(c => S.pre.fit[c.id] !== 'poor').map(c => c.id);
    S.canGrow = new Set(local.length ? local : CROPS.map(c => c.id));
    S.lastCrop = raw.lastCrop && S.canGrow.has(raw.lastCrop) ? raw.lastCrop : [...S.canGrow][0];
    S.soil = 'map';
    status1(t('loaded', { start: ymd(raw.start), end: ymd(raw.end) }));
    renderPresets(); renderNasa(); renderStep2();
    $('to2').disabled = false;
    go(1);
  }

  async function fetchLive(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 70 || Math.abs(lon) > 180) { status1(t('geoBlocked'), 'warn'); return; }
    const btn = $('fetch'); btn.disabled = true; status1(t('loading'));
    const end = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const params = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'GWETROOT', 'ALLSKY_SFC_SW_DWN', 'RH2M', 'WS2M'];
    const short = { T2M: 't', T2M_MAX: 'tx', T2M_MIN: 'tn', PRECTOTCORR: 'p', GWETROOT: 'w', ALLSKY_SFC_SW_DWN: 'rs', RH2M: 'rh', WS2M: 'u' };
    try {
      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params.join(',')}&community=AG&latitude=${lat}&longitude=${lon}&start=20010101&end=${end}&format=JSON`;
      const d = await (await fetch(url)).json();
      const par = d.properties.parameter, dates = Object.keys(par.T2M).sort();
      while (dates.length && params.some(k => par[k][dates[dates.length - 1]] === -999)) dates.pop();
      const series = {};
      for (const k of params) { let last = 0; series[short[k]] = dates.map(dt => { let v = par[k][dt]; if (v === -999) v = last; last = v; return v; }); }
      let soil = null;
      try {
        const q = 'property=clay&property=sand&property=soc&depth=0-5cm&depth=5-15cm&depth=15-30cm&depth=30-60cm&value=mean';
        const sg = await (await fetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&${q}`)).json();
        soil = {};
        for (const L of sg.properties.layers) { const v = L.depths.map(x => x.values.mean).filter(x => x != null).map(x => x / L.unit_measure.d_factor); if (v.length) soil[L.name] = v.reduce((a, b) => a + b, 0) / v.length; }
        if (soil.sand == null) soil = null;
      } catch (e) { soil = null; }
      loadRaw({ id: 'custom', name: null, lat, lon, elev: d.geometry.coordinates[2], start: dates[0], end: dates[dates.length - 1], soil, series });
    } catch (e) {
      status1(t('liveBlocked'), 'err');
    } finally { btn.disabled = false; }
  }
  $('fetch').addEventListener('click', () => fetchLive(+$('lat').value, +$('lon').value));
  $('geo').addEventListener('click', () => {
    $('coordsBox').open = true;
    if (!navigator.geolocation) { status1(t('geoBlocked'), 'warn'); return; }
    navigator.geolocation.getCurrentPosition(
      p => { $('lat').value = p.coords.latitude.toFixed(2); $('lon').value = p.coords.longitude.toFixed(2); fetchLive(+$('lat').value, +$('lon').value); },
      () => status1(t('geoBlocked'), 'warn'), { timeout: 10000 });
  });

  function rainChart(months) {
    const W = 640, H = 110, pad = 18, bw = (W - 8) / 12, max = Math.max(...months.map(m => m.rain), 1);
    let s = `<svg viewBox="0 0 ${W} ${H + pad}" role="img" aria-label="${esc(t('rainLegend'))}">`;
    months.forEach((m, i) => {
      const h = Math.max(2, m.rain / max * (H - 18)), x = 4 + i * bw;
      s += `<rect x="${(x + 3).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="var(--sky)"><title>${esc(monthLong(i))}: ${n0(m.rain)} mm</title></rect>`;
      s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H + 14}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(monthShort(i).slice(0, 3))}</text>`;
      if (m.rain === max) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(H - h - 5).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${n0(m.rain)}</text>`;
    });
    return s + `<line x1="4" x2="${W - 4}" y1="${H}" y2="${H}" stroke="var(--line)"/></svg>`;
  }

  function renderNasa() {
    const c = S.pre.clim, el = $('nasa'); el.hidden = false;
    const y0 = c.years[0], y1 = c.years[c.years.length - 1];
    const a = c.soilNow.anomaly, soilLine = a < -0.04 ? t('soilNowDry') : a > 0.04 ? t('soilNowWet') : t('soilNowNormal');
    const pos = Math.max(4, Math.min(96, 50 + a / 0.25 * 50));
    const tr = c.summerTrend;
    el.innerHTML = `<div><h2>${esc(t('nasaTitle', { place: placeName() }))}</h2><p class="muted small">${esc(t('nasaSub', { y0, y1 }))}</p></div>
      <div class="facts">
        <div class="fact" style="grid-column:1/-1"><span class="ico" aria-hidden="true">🌧️</span><div style="flex:1;min-width:0"><p><b>${esc(t('rainFact', { mm: n0(c.annualRain) }))}</b></p><p>${esc(t('rainWhen', { months: c.wettest3.map(monthLong).join(', ') }))} ${esc(t('rainRange', { dry: n0(c.minRain), wet: n0(c.maxRain) }))}</p><div class="rainchart">${rainChart(c.months)}</div></div></div>
        <div class="fact"><span class="ico" aria-hidden="true">❄️</span><p>${esc(c.frost ? t('frostFact', { spring: doyDate(c.frost.lastSpring), autumn: doyDate(c.frost.firstAutumn) }) : t('noFrost'))}</p></div>
        <div class="fact"><span class="ico" aria-hidden="true">🔥</span><div><p>${esc(t('heatFact', { n: n0(c.hotDays) }))}</p><p class="muted small">${esc(tr.significant && tr.slopePerDecade > 0 ? t('trendWarm', { v: tr.slopePerDecade.toFixed(1) }) : t('trendNone'))}</p></div></div>
        <div class="fact"><span class="ico" aria-hidden="true">💧</span><div style="flex:1"><p><b>${esc(soilLine)}</b></p><div class="gauge" aria-hidden="true"><span>${S.lang === 'ru' ? 'сухо' : 'dry'}</span><span class="bar"><i style="left:${pos}%"></i></span><span>${S.lang === 'ru' ? 'влажно' : 'wet'}</span></div><p class="muted small">${esc(t('soilAsOf', { date: ymd(S.raw.end) }))}</p></div></div>
      </div>`;
  }

  // ---------- step 2: farm ----------
  const FIT_STYLE = { good: ['var(--good-wash)', 'var(--good)', 'fitGood', '✓'], risky: ['var(--ok-wash)', 'var(--ok)', 'fitRisky', '!'], poor: ['var(--bad-wash)', 'var(--bad)', 'fitPoor', '✕'] };
  const fitChip = id => { const f = S.pre.fit[id], st = FIT_STYLE[f]; return `<span class="fitchip" style="background:${st[0]};color:${st[1]}">${st[3]} ${esc(t(st[2]))}</span>`; };

  function renderStep2() {
    if (!S.pre) return;
    const pool = CROPS.filter(c => S.canGrow.has(c.id));
    $('lastCrop').innerHTML = pool.map(c => `<button type="button" class="choice" role="radio" aria-checked="${c.id === S.lastCrop}" data-last="${c.id}"><span class="ico" aria-hidden="true">${c.icon}</span><b>${esc(cname(c))}</b><span class="tick" aria-hidden="true">${c.id === S.lastCrop ? '✓' : ''}</span></button>`).join('');
    $('lastCrop').querySelectorAll('[data-last]').forEach(b => b.addEventListener('click', () => { S.lastCrop = b.dataset.last; renderStep2(); }));
    $('canGrow').innerHTML = CROPS.map(c => `<button type="button" class="choice" aria-pressed="${S.canGrow.has(c.id)}" data-can="${c.id}"><span class="ico" aria-hidden="true">${c.icon}</span><b>${esc(cname(c))}</b>${fitChip(c.id)}<span class="tick" aria-hidden="true">${S.canGrow.has(c.id) ? '✓' : ''}</span></button>`).join('');
    $('canGrow').querySelectorAll('[data-can]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.can;
      if (S.canGrow.has(id)) { if (S.canGrow.size > 2) S.canGrow.delete(id); } else S.canGrow.add(id);
      if (!S.canGrow.has(S.lastCrop)) S.lastCrop = [...S.canGrow][0];
      renderStep2();
    }));
    const mapT = S.pre.soil.texture;
    $('soilMap').textContent = S.raw.soil ? t('soilMapSays', { t: t(mapT) }) : '';
    const cur = S.soil === 'map' ? mapT : S.soil;
    $('soilPick').innerHTML = [['sandy', '🏖️'], ['medium', '🟫'], ['clay', '🧱']].map(([k, ic]) => `<button type="button" class="choice" role="radio" aria-checked="${cur === k}" data-soil="${k}"><span class="ico" aria-hidden="true">${ic}</span><span><b>${esc(t(k))}</b><small>${esc(t(k + 'Hint'))}</small></span><span class="tick" aria-hidden="true">${cur === k ? '✓' : ''}</span></button>`).join('');
    $('soilPick').querySelectorAll('[data-soil]').forEach(b => b.addEventListener('click', () => { S.soil = b.dataset.soil === mapT && S.raw.soil ? 'map' : b.dataset.soil; renderStep2(); }));
    $('prio').innerHTML = [['safety', '💧', 'prioSafety'], ['soil', '🌱', 'prioSoil'], ['income', '💰', 'prioIncome']].map(([k, ic, lab]) => `<button type="button" class="choice" role="radio" aria-checked="${S.priority === k}" data-prio="${k}"><span class="ico" aria-hidden="true">${ic}</span><b>${esc(t(lab))}</b><span class="tick" aria-hidden="true">${S.priority === k ? '✓' : ''}</span></button>`).join('');
    $('prio').querySelectorAll('[data-prio]').forEach(b => b.addEventListener('click', () => { S.priority = b.dataset.prio; renderStep2(); }));
  }
  $('to2').addEventListener('click', () => go(2));

  // ---------- step 3: plan ----------
  function compute() {
    const exclude = new Set(CROPS.filter(c => !S.canGrow.has(c.id) && c.id !== S.lastCrop).map(c => c.id));
    const soilSrc = S.soil === 'map' ? S.raw.soil : { texture: S.soil };
    S.res = E.analyse(S.site, CROPS, { lastCrop: S.lastCrop, priority: S.priority, exclude, soilSrc, dT: S.dT, rainMult: S.rainMult });
    S.sel = S.res.plans.findIndex(p => p.recommended);
  }
  $('make').addEventListener('click', () => {
    const b = $('make'); b.disabled = true;
    setTimeout(() => { compute(); renderStep3(); b.disabled = false; go(3); }, 30);
  });

  const level = x => (x >= 0.7 ? 'high' : x >= 0.45 ? 'mid' : 'low');
  const planName = p => t({ keep: 'planKeep', small: 'planSmall', big: 'planBig' }[p.kind]);
  const goodOf10 = p => Math.round(E.mean(p.seasons.map(s => s.counts.good / s.counts.n)) * 10);
  const planYear = () => { const r = S.res, end = r.site.end, ev = r.plans[S.sel].seasons[0].ev; return +end.slice(4, 6) >= ev.m ? +end.slice(0, 4) + 1 : +end.slice(0, 4); };
  function seqHtml(p, withYears) {
    const y0 = planYear();
    return `<div class="seq">${p.seasons.map((s, i) => `${i ? '<span class="arr" aria-hidden="true">→</span>' : ''}<span class="s"><span class="ico" aria-hidden="true">${s.crop.icon}</span><span><b>${esc(cname(s.crop))}</b>${withYears ? `<small>${y0 + i}</small>` : ''}</span></span>`).join('')}</div>`;
  }
  function years10(p) {
    const g = goodOf10(p), b = Math.round(E.mean(p.seasons.map(s => s.counts.bad / s.counts.n)) * 10), o = Math.max(0, 10 - g - b);
    const out = []; for (let i = 0; i < g; i++) out.push('<span class="y-good">✓</span>'); for (let i = 0; i < o; i++) out.push('<span class="y-ok">~</span>'); for (let i = 0; i < 10 - g - o; i++) out.push('<span class="y-bad">✕</span>');
    return `<div class="years10" role="img" aria-label="${g} ${esc(t('goodYears'))}">${out.join('')}</div>`;
  }
  function rating(icon, label, x) { const l = level(x); return `<div class="rating"><span aria-hidden="true">${icon}</span><span>${esc(t(label))}</span><span class="row" style="gap:8px"><span class="lvl ${l}" aria-hidden="true"><i></i><i></i><i></i></span><b>${esc(t(l))}</b></span></div>`; }

  function renderStep3() {
    const r = S.res, rec = r.plans.find(p => p.recommended);
    $('hero').innerHTML = `<span class="row"><span class="fitchip" style="background:var(--green);color:var(--green-ink)">★ ${esc(t('recommended'))}</span><b>${esc(planName(rec))}</b></span>${seqHtml(rec, true)}<p style="font-size:1.15rem"><b>${esc(t('summaryLine', { crops: rec.seasons.map(s => cname(s.crop)).join(' → '), good: goodOf10(rec) }))}</b></p>${years10(rec)}`;
    $('plans').innerHTML = r.plans.map((p, i) => `<article class="plan ${i === S.sel ? 'sel' : ''}">${p.recommended ? `<span class="badge">★ ${esc(t('recommended'))}</span>` : ''}<h3>${esc(planName(p))}</h3>${seqHtml(p)}
      <div style="display:flex;flex-direction:column;gap:6px">${rating('💧', 'ratingSafety', p.safety)}${rating('🌱', 'ratingSoil', p.soil)}${rating('💰', 'ratingIncome', p.income)}</div>
      <div><p class="small">${esc(t('goodYearsN', { g: goodOf10(p) }))}</p>${years10(p)}</div>
      <button type="button" class="big-btn ${i === S.sel ? '' : 'secondary'}" data-sel="${i}" aria-pressed="${i === S.sel}">${esc(i === S.sel ? '✓ ' + t('chosen') : t('choose'))}</button></article>`).join('');
    $('plans').querySelectorAll('[data-sel]').forEach(b => b.addEventListener('click', () => { S.sel = +b.dataset.sel; renderStep3(); }));
    renderCalendar(); renderOutlook(); renderWhy(); renderSources();
    $('hot').setAttribute('aria-pressed', String(S.dT > 0)); $('dry').setAttribute('aria-pressed', String(S.rainMult < 1));
    const what = [S.dT > 0 ? t('hotter') : '', S.rainMult < 1 ? t('drier') : ''].filter(Boolean).join(' + ');
    $('whatIfNote').textContent = what ? t('whatIfOn', { what }) : '';
  }

  function renderCalendar() {
    const p = S.res.plans[S.sel], clim = S.res.clim, y0 = planYear(), max = Math.max(...clim.months.map(m => m.rain), 1);
    let h = `<div class="cal-wrap"><div class="cal" role="table" aria-label="${esc(t('calTitle'))}"><div></div>${clim.months.map((_, i) => `<div class="mh">${esc(monthShort(i).slice(0, 3))}</div>`).join('')}`;
    h += `<div class="yl" title="${esc(t('rainLegend'))}">🌧️</div>${clim.months.map(m => `<div class="cell" style="height:54px;align-items:flex-end" title="${n0(m.rain)} mm"><i style="display:block;width:60%;border-radius:4px 4px 0 0;background:var(--sky);height:${Math.max(2, m.rain / max * 50).toFixed(0)}px"></i></div>`).join('')}`;
    p.seasons.forEach((s, k) => {
      const firstM = s.ev.m - 1;
      h += `<div class="yl">${y0 + k}</div>`;
      for (let m = 0; m < 12; m++) {
        const crop = s.cover.includes(m), cls = crop ? 'crop' + (m === firstM ? ' first' : '') : s.snow[m] ? 'snow' : 'bare';
        const label = crop ? cname(s.crop) : s.snow[m] ? t('snow') : t('bare');
        h += `<div class="cell ${cls}" title="${esc(monthLong(m) + ': ' + label)}">${crop && m === firstM ? `<span aria-hidden="true">${s.crop.icon}</span>` : ''}</div>`;
      }
    });
    h += `</div></div><div class="cal-legend"><span><i style="background:var(--green-wash);border:1.5px solid var(--green)"></i>${esc(S.lang === 'ru' ? 'Культура в поле' : 'Crop in the field')}</span><span><i style="background:repeating-linear-gradient(135deg,var(--soil-wash) 0 4px,transparent 4px 7px);border:1px dashed var(--soil)"></i>${esc(t('bare'))}</span>${p.seasons.some(s => s.snow.some(Boolean)) ? `<span><i style="background:var(--snow)"></i>${esc(t('snow'))}</span>` : ''}<span><i style="background:var(--sky)"></i>${esc(t('rainLegend'))}</span></div>`;
    h += `<div class="dates">${p.seasons.map((s, k) => { const L = E.seasonLength(s.crop), hv = new Date(Date.UTC(2001, s.ev.m - 1, s.ev.d) + L * 86400000); return `<p><span aria-hidden="true">${s.crop.icon}</span> <b>${y0 + k} · ${esc(cname(s.crop))}:</b> ${esc(t('sow'))} ${esc(dayMonth(s.ev.m, s.ev.d))} → ${esc(t('harvest'))} ${esc(dayMonth(hv.getUTCMonth() + 1, hv.getUTCDate()))}</p>`; }).join('')}</div>`;
    $('calendar').innerHTML = h;
  }

  function renderOutlook() {
    const r = S.res, p = r.plans[S.sel], s = p.seasons[0], ev = s.ev;
    // recompute outlook for the selected plan's first crop, from today's soil moisture
    const sc = E.scenario(r.site, S.dT, S.rainMult), doy = Math.floor((Date.UTC(2001, ev.m - 1, ev.d) - Date.UTC(2001, 0, 1)) / 86400000) + 1;
    const w0 = Math.max(0.02, Math.min(1, r.site.wClim[doy] + 0.5 * r.clim.soilNow.anomaly));
    const runs = ev.runs.map(x => ({ year: x.year, run: E.runSeason(r.site, sc, r.soil, s.crop, Math.round((Date.UTC(x.year, ev.m - 1, ev.d) - r.site.t0) / 86400000), w0) })).filter(x => x.run);
    const cls = v => (v >= 0.75 ? ['y-good', '✓', 'outGood'] : v >= 0.5 ? ['y-ok', '~', 'outOk'] : ['y-bad', '✕', 'outBad']);
    const vals = runs.map(x => ({ year: x.year, v: Math.min(1, x.run.yi * s.rot.f) }));
    const cnt = { outGood: 0, outOk: 0, outBad: 0 }; vals.forEach(x => cnt[cls(x.v)[2]]++);
    $('outlook').innerHTML = `<p>${esc(t('outlookLine', { crop: cname(s.crop).toLowerCase(), date: dayMonth(ev.m, ev.d) + ' ' + planYear(), n: vals.length }))}</p>
      <div class="dots26">${vals.map(x => { const c = cls(x.v); return `<span class="${c[0]}" title="${x.year} weather: ${esc(t(c[2]))}">${c[1]}</span>`; }).join('')}</div>
      <div class="legend3">${['outGood', 'outOk', 'outBad'].map(k => { const c = { outGood: ['y-good', '✓'], outOk: ['y-ok', '~'], outBad: ['y-bad', '✕'] }[k]; return `<span><i class="${c[0]}">${c[1]}</i><b>${cnt[k]}</b> ${esc(t(k))}</span>`; }).join('')}</div>
      <p class="muted small">${esc(t('outlookNote'))}</p>`;
    S.outlookCounts = cnt;
  }

  function renderWhy() {
    const p = S.res.plans[S.sel], items = [];
    const leg = p.seasons.find(s => s.crop.legume);
    if (leg) items.push([leg.crop.icon, t('whyLegume', { crop: cname(leg.crop) })]);
    if (p.families >= 2) items.push(['🐛', t('whyBreak')]);
    const rep = p.seasons.find(s => s.rot.why.includes('repeat'));
    if (rep) items.push(['⚠️', t('whyRepeat', { crop: cname(rep.crop).toLowerCase() })]);
    const best = p.seasons.reduce((a, b) => (b.counts.good / b.counts.n > a.counts.good / a.counts.n ? b : a));
    items.push(['🌦️', t('whyDry', { crop: cname(best.crop), n: Math.round(best.counts.good / best.counts.n * 10) })]);
    const f = p.seasons[0];
    items.push(['💧', t(f.ev.medRain >= f.ev.medNeed * 0.9 ? 'whyWaterOk' : 'whyWater', { crop: cname(f.crop), need: n0(f.ev.medNeed), rain: n0(f.ev.medRain) })]);
    if (p.bareMonths >= 1) items.push(['🟫', t('whyBare', { n: Math.round(p.bareMonths) })]);
    $('why').innerHTML = items.map(([i, s]) => `<li><span class="ico" aria-hidden="true">${i}</span><span>${esc(s)}</span></li>`).join('');
  }

  function renderSources() {
    const r = S.res, assumed = CROPS.filter(c => c.kyAssumed).map(cname).join(', ');
    const items = S.lang === 'ru' ? [
      `NASA POWER, ежедневные данные (сообщество AG): температура, осадки, влажность корнеобитаемого слоя, солнечная радиация, влажность воздуха, ветер. ${ymd(S.raw.start)} – ${ymd(S.raw.end)}. Сетка около 50 км.`,
      'Испарение по FAO-56 (Пенман–Монтейт); водный баланс почвы по дням с коэффициентами культур FAO-56; снижение урожая из-за нехватки воды по FAO-33 (Ky).',
      `Почва: ISRIC SoilGrids 2.0 (модель, 250 м) или ваш выбор. Доступная влага около ${n0(r.soil.awc)} мм на метр.`,
      `Севооборот: +10% после бобовых, −10% при той же семье культур, −15% при повторе культуры. Это упрощённые правила для проверки агрономом.`,
      `Ky для культур (${assumed}) взяты как предположение. Нужна проверка агронома.`,
      'Результаты — оценка по прошлой погоде, а не прогноз урожая.'] : [
      `NASA POWER daily data (AG community): air temperature, rainfall, root-zone soil wetness, solar radiation, humidity and wind, ${ymd(S.raw.start)} to ${ymd(S.raw.end)}. Grid of about 50 km.`,
      'Water demand by FAO-56 Penman–Monteith; daily soil-water balance with FAO-56 crop coefficients; yield loss from water shortage by FAO-33 (Ky). Heat at flowering and frost reduce the score.',
      `Soil: ISRIC SoilGrids 2.0 (modelled, 250 m) or your own choice. Plant-available water about ${n0(r.soil.awc)} mm per metre of soil.`,
      'Rotation rules: +10% after a legume, −10% after a crop of the same family, −15% when the same crop repeats. Simplified screening rules for agronomist review.',
      `Ky for ${assumed} is assumed, not from FAO-33. Needs agronomist review.`,
      'Results replay past weather. They are screening estimates, not a yield forecast.'];
    $('sources').innerHTML = items.map(s => `<li>${esc(s)}</li>`).join('');
  }

  function rerun() { compute(); renderStep3(); }
  $('hot').addEventListener('click', () => { S.dT = S.dT ? 0 : 2; rerun(); });
  $('dry').addEventListener('click', () => { S.rainMult = S.rainMult < 1 ? 1 : 0.8; rerun(); });

  // ---------- share & listen ----------
  function summaryText() {
    if (S.step === 3 && S.res) {
      const p = S.res.plans[S.sel], y0 = planYear();
      const lines = [`Fieldwise — ${placeName()}`, `${planName(p)}: ${p.seasons.map((s, i) => `${y0 + i} ${cname(s.crop)}`).join(' → ')}`,
        t('summaryLine', { crops: p.seasons.map(s => cname(s.crop)).join(' → '), good: goodOf10(p) })];
      p.seasons.forEach((s, k) => { const L = E.seasonLength(s.crop), hv = new Date(Date.UTC(2001, s.ev.m - 1, s.ev.d) + L * 86400000); lines.push(`${y0 + k} ${cname(s.crop)}: ${t('sow')} ${dayMonth(s.ev.m, s.ev.d)}, ${t('harvest')} ${dayMonth(hv.getUTCMonth() + 1, hv.getUTCDate())}`); });
      lines.push(t('checkTitle') + ': ' + [t('check1'), t('check2'), t('check3'), t('check4')].join(' '));
      return lines.join('\n');
    }
    if (S.pre) { const c = S.pre.clim; return [t('nasaTitle', { place: placeName() }), t('rainFact', { mm: n0(c.annualRain) }), t('rainWhen', { months: c.wettest3.map(monthLong).join(', ') }), c.frost ? t('frostFact', { spring: doyDate(c.frost.lastSpring), autumn: doyDate(c.frost.firstAutumn) }) : t('noFrost')].join(' '); }
    return t('whereTitle') + ' ' + t('whereHelp');
  }
  $('copy').addEventListener('click', () => {
    const text = summaryText();
    const done = () => toast(t('copied'));
    try { navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done)); } catch (e) { fallbackCopy(text, done); }
  });
  function fallbackCopy(text, done) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } ta.remove(); }
  function stopSpeech() { try { speechSynthesis.cancel(); } catch (e) { /* no speech */ } $('listen').setAttribute('aria-pressed', 'false'); $('listen').querySelector('[data-t]').textContent = t('listen'); }
  $('listen').addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return;
    if ($('listen').getAttribute('aria-pressed') === 'true') { stopSpeech(); return; }
    const u = new SpeechSynthesisUtterance(summaryText().replace(/→/g, ', then ').replace(/\n/g, '. '));
    u.lang = S.lang === 'ru' ? 'ru-RU' : 'en-US'; u.rate = 0.92; u.onend = stopSpeech;
    $('listen').setAttribute('aria-pressed', 'true'); $('listen').querySelector('[data-t]').textContent = t('stop');
    speechSynthesis.speak(u);
  });
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    S.lang = b.dataset.lang; try { localStorage.setItem('fieldwise-lang', S.lang); } catch (e) { /* ignore */ }
    applyStatic(); renderPresets();
    if (S.pre) { renderNasa(); renderStep2(); }
    if (S.res) renderStep3();
    if (S.raw) status1(t('loaded', { start: ymd(S.raw.start), end: ymd(S.raw.end) }));
  }));

  // ---------- start: open with the first example loaded so the page shows real data ----------
  applyStatic(); renderPresets();
  loadRaw(window.PRESETS[0]);
})();
