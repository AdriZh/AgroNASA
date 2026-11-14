import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis, Cell, Tooltip } from 'recharts';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import { seasonEndOf } from './Evidence';
import { cropEmoji, cropName } from '../../data/crops';
import { fmtMoney } from '../../domain/units';
import { yearlyWindow, median } from '../../weather/indicators';
import { pct } from '../components/common';
import type { PlanResult } from '../../engine/plan';

function Slide({ n, kicker, children }: { n: number; kicker: string; children: ReactNode }) {
  return (
    <div className="slide">
      <div className="kicker">{kicker}</div>
      {children}
      <div className="foot"><span>Field Shift · NASA Space Apps 2026</span><span>{n} / 7</span></div>
    </div>
  );
}

function PlanMini({ p, cur }: { p: PlanResult; cur: string }) {
  const ok = p.budget.status === 'affordable';
  return (
    <div className="card" style={{ padding: 16, border: p.isBaseline ? '1px dashed rgba(255,255,255,.3)' : p.rank === 1 ? '2px solid #7fd6a4' : undefined }}>
      <div className="muted" style={{ fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{p.isBaseline ? 'Usual plan' : p.label}</div>
      <div style={{ fontWeight: 800, fontSize: '1.15rem', margin: '6px 0' }}>{cropEmoji(p.crops[0])} {cropName(p.crops[0])} → {cropEmoji(p.crops[1])} {cropName(p.crops[1])}</div>
      <div style={{ color: ok ? '#7fd6a4' : '#ff8a80', fontWeight: 700 }}>{ok ? `✓ fits · +${fmtMoney(p.budget.headroom, cur)}` : p.budget.status === 'unaffordable' ? `✕ over by ${fmtMoney(-p.budget.headroom, cur)}` : p.budget.status}</div>
      <div className="muted" style={{ fontSize: '.85rem', marginTop: 4 }}>cash {fmtMoney(p.budget.totalCash, cur)} · severe-stress risk {pct(p.outcome.pSevereAny)}</div>
    </div>
  );
}

export function PitchPage({ go }: { go: (r: Route) => void }) {
  const [i, setI] = useState(0);
  const { engine, data, scenario } = useApp();
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') setI((x) => Math.min(6, x + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI((x) => Math.max(0, x - 1));
      if (e.key === 'Escape') go('overview');
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [go]);
  const rows = useMemo(() => (data.series && engine ? yearlyWindow(data.series, engine.window.earliest, seasonEndOf(engine)) : []), [data.series, engine]);
  const mn = rows.length ? Math.min(...rows.map((r) => r.windowRain)) : 0, mx = rows.length ? Math.max(...rows.map((r) => r.windowRain)) : 0;
  const cur = scenario.currency;
  const place = scenario.location.label ?? '';

  const slides: ReactNode[] = [
    <Slide n={1} kicker="NASA Space Apps 2026 · Field Shift challenge">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🛰️🌾</div>
        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4.6rem)', margin: '10px 0' }}>Field Shift</h1>
        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.6rem)', maxWidth: 900 }}>Affordable two-season crop-rotation plans from <b style={{ color: '#9be15d' }}>25 years of NASA Earth data</b> + what farmers already know: their history, soil, budget and constraints.</p>
        <p className="muted">Informs rather than decides · explains every trade-off · works offline · no account</p>
      </div>
    </Slide>,
    <Slide n={2} kicker="The problem">
      <h2>The right crop can still be the wrong plan</h2>
      <div className="grid g2" style={{ flex: 1, alignItems: 'center' }}>
        <ul style={{ lineHeight: 1.7 }}>
          <li>Rotation choices are made with <b>uncertain rain, limited cash and patchy records</b>.</li>
          <li>At {place.split(',')[0] || 'this site'}, NASA POWER season rain ranged <b>{Math.round(mn)}–{Math.round(mx)} mm</b> — {(mx / Math.max(1, mn)).toFixed(1)}× — an “average year” hides the risk.</li>
          <li>Inputs don’t always pay: fertilizer was profitable in only <b>30–84%</b> of studied site-seasons in East Africa (R1).</li>
          <li>An agronomically ideal plan the farmer <b>cannot afford before planting</b> is not a plan.</li>
        </ul>
        <div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rows}>
              <XAxis dataKey="year" tick={{ fill: '#8ea3c2', fontSize: 11 }} interval={3} />
              <YAxis tick={{ fill: '#8ea3c2', fontSize: 11 }} unit=" mm" width={60} />
              <Tooltip contentStyle={{ background: '#0b1d36', border: '1px solid #1e3a63' }} />
              <ReferenceLine y={median(rows.map((r) => r.windowRain))} stroke="#fff" strokeDasharray="4 3" />
              <Bar isAnimationActive={false} dataKey="windowRain" name="Season rain">{rows.map((r) => <Cell key={r.year} fill={r.windowRain === mn ? '#ff8a80' : r.windowRain === mx ? '#9be15d' : '#5b8def'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="muted" style={{ fontSize: '.75rem' }}>Season rainfall by year, NASA POWER PRECTOTCORR, {place}</div>
        </div>
      </div>
    </Slide>,
    <Slide n={3} kicker="Our solution">
      <h2>One question, answered transparently</h2>
      <p style={{ fontSize: 'clamp(1rem, 1.8vw, 1.4rem)', color: '#fff' }}>“Given what I grew and applied before, my money now and the conditions here — which next two-season plans can I realistically consider and afford?”</p>
      <div className="grid g4" style={{ marginTop: 18 }}>
        {[['1', 'Farm & history', 'Map pin, area, last crops & outcomes, fertilizer records, soil'], ['2', 'Resources', 'Cash, reserve, dated inflows, labor, seed, market, irrigation, one priority'], ['3', 'Compare', 'Usual plan vs ≤2 feasible alternatives: cost, headroom, cash timing, risk, reasons'], ['4', 'Evidence', 'NASA climate, season-so-far, forecast, satellite layers, past-season review']].map(([n, t, d]) => (
          <div key={n} className="card"><div className="big" style={{ fontSize: '2rem' }}>{n}</div><b>{t}</b><p style={{ fontSize: '.9rem' }}>{d}</p></div>
        ))}
      </div>
    </Slide>,
    <Slide n={4} kicker="Data fusion">
      <h2>NASA + ground truth → explainable plans</h2>
      <div className="grid g3" style={{ flex: 1, alignItems: 'stretch' }}>
        <div className="card"><b>🛰️ NASA</b><ul style={{ fontSize: '.9rem', paddingLeft: 18 }}><li>POWER daily: rain, Tmax/Tmin, RH, wind, solar (2001→now)</li><li>POWER GWETROOT soil wetness</li><li>GIBS: MODIS NDVI, SMAP L4 soil moisture, GPM IMERG, MODIS LST</li></ul></div>
        <div className="card"><b>🧮 Field Shift engine</b><ul style={{ fontSize: '.9rem', paddingLeft: 18 }}><li>FAO-56 Penman–Monteith ET₀</li><li>Rain-onset / soil-warming sowing dates</li><li>Daily soil-water balance × 25 seasons</li><li>FAO-66 yield response (Ky)</li><li>Rule pack + cash-timing check</li></ul></div>
        <div className="card"><b>👩🏾‍🌾 Non-NASA</b><ul style={{ fontSize: '.9rem', paddingLeft: 18 }}><li>Farmer history & fertilizer records</li><li>Budget, inflows, editable local prices</li><li>ISRIC SoilGrids → water capacity</li><li>Open-Meteo 16-day forecast</li><li>Regional rule packs with sources</li></ul></div>
      </div>
    </Slide>,
    <Slide n={5} kicker={`Live result · ${scenario.name}`}>
      <h2>{engine?.baseline.budget.status === 'affordable' ? 'The usual plan fits — here is how alternatives compare' : 'The usual plan does not fit the budget — two that do'}</h2>
      {engine ? (
        <>
          <div className="grid g3" style={{ marginTop: 10 }}>{[engine.baseline, ...engine.alternatives].map((p) => <PlanMini key={p.id} p={p} cur={cur} />)}</div>
          <ul style={{ marginTop: 16, fontSize: '.95rem' }}>
            <li>{engine.allPlans.length + 1} rotations screened · {engine.excluded.length} excluded, each with a reason code (return interval, disease group, budget, climate…)</li>
            <li>Risk = FAO-56 water balance replayed over {Object.values(engine.risks)[0]?.years.length} NASA POWER seasons at this grid cell — a historical scenario, not a forecast</li>
            <li>Change a price, the budget or seed availability → results and reasons update instantly</li>
          </ul>
        </>
      ) : <p>Loading…</p>}
    </Slide>,
    <Slide n={6} kicker="Validity">
      <h2>Honest by construction</h2>
      <div className="grid g2" style={{ flex: 1 }}>
        <div className="card"><b>✅ Verified</b><ul style={{ fontSize: '.92rem', paddingLeft: 18 }}><li>25 automated acceptance tests</li><li>Reproduces archived NASA query exactly: 9,131 records; Jun–Oct 2002 = 308.92 mm, 2009 = 975.63 mm</li><li>FAO-56 textbook ET₀ example matches</li><li>Budget boundary 900 ✓ / 900.01 ✕; no “affordable” plan breaks cash timing</li><li>Deterministic — no LLM in the decision path</li></ul></div>
        <div className="card"><b>🚫 Never claimed</b><ul style={{ fontSize: '.92rem', paddingLeft: 18 }}><li>Guaranteed yield or profit</li><li>Why a crop failed (we report possible stresses only)</li><li>Soil N–P–K from purchase history</li><li>Fertilizer doses</li><li>Validation we have not done: rule packs await local agronomist review; prices are synthetic until replaced</li></ul></div>
      </div>
    </Slide>,
    <Slide n={7} kicker="Impact & next steps">
      <h2>Built to scale from one field to a cooperative</h2>
      <div className="grid g3" style={{ marginTop: 6 }}>
        <div className="card"><div className="big">Global</div><p>Works anywhere NASA POWER exists; reviewed packs for Senegal & N. Kazakhstan, generic screening elsewhere.</p></div>
        <div className="card"><div className="big">≈ $0</div><p>Static web app, offline after first load, free static hosting. Data stays on the device.</p></div>
        <div className="card"><div className="big">90 days</div><p>Pilot: 3–5 farmer interviews, agronomist review of every rule, dated local price pack, usability tests.</p></div>
      </div>
      <ul style={{ marginTop: 16 }}>
        <li><b>Users:</b> smallholders with extension workers, cooperatives, input-credit programmes.</li>
        <li><b>Roadmap:</b> French / Wolof / Kazakh / Russian, printable SMS summary, cooperative dashboard, NDVI time series per field.</li>
      </ul>
    </Slide>,
  ];

  return (
    <div className="pitch">
      <div className="pitch-stage" onClick={(e) => { const x = (e as any).clientX / window.innerWidth; setI((v) => (x > 0.5 ? Math.min(6, v + 1) : Math.max(0, v - 1))); }}>{slides[i]}</div>
      <div className="pitch-bar">
        <button className="btn sm" onClick={() => go('overview')}>✕ Exit (Esc)</button>
        <span>← → to navigate · click right/left half · slide {i + 1} of 7</span>
        <div className="row"><button className="btn sm" onClick={() => setI((v) => Math.max(0, v - 1))}>‹ Prev</button><button className="btn sm" onClick={() => setI((v) => Math.min(6, v + 1))}>Next ›</button></div>
      </div>
    </div>
  );
}
