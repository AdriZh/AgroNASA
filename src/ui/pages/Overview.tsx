import { useMemo } from 'react';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import { seasonEndOf } from './Evidence';
import { DEMOS } from '../../state/demo';
import { cropEmoji, cropName } from '../../data/crops';
import { fmtMoney } from '../../domain/units';
import { yearlyWindow } from '../../weather/indicators';
import { SeasonRainChart } from '../components/charts';
import { Kpi, Loading, pct } from '../components/common';

export function Overview({ go }: { go: (r: Route) => void }) {
  const { scenario, resetDemo, createNew, engine, data } = useApp();
  const rows = useMemo(() => {
    if (!data.series || !engine) return [];
    const w = engine.window;
    const end = seasonEndOf(engine);
    return yearlyWindow(data.series, w.earliest, end);
  }, [data.series, engine]);
  const min = rows.length ? rows.reduce((a, r) => (r.windowRain < a.windowRain ? r : a)) : null;
  const max = rows.length ? rows.reduce((a, r) => (r.windowRain > a.windowRain ? r : a)) : null;
  const best = engine?.alternatives[0];

  return (
    <div>
      <section className="hero">
        <div className="stars" />
        <div className="eyebrow" style={{ color: '#7fd6a4' }}>NASA Space Apps 2026 · Field Shift challenge</div>
        <h1>Plan your next two seasons with satellite climate history — and the money you actually have.</h1>
        <p>
          Field Shift fuses 25 years of NASA Earth observations with what the farmer knows — past crops, fertilizer, soil, budget, labor and markets —
          to compare affordable crop-rotation plans, explain every trade-off, and show the climate risk of each option before seed is bought.
        </p>
        <div className="cta">
          {DEMOS.map((d) => <button key={d.id} className="btn light" onClick={() => { resetDemo(d.id); go('compare'); }}>▶ {d.location.label?.split(',').slice(-1)[0].trim()} demo</button>)}
          <button className="btn outline" onClick={() => { createNew(); go('farm'); }}>＋ Plan my own farm</button>
          <button className="btn outline" onClick={() => go('pitch')}>Presentation mode</button>
        </div>
      </section>

      <section className="section grid g-side">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Current scenario</div>
              <h3>{scenario.name}</h3>
            </div>
            <button className="btn sm" onClick={() => go('compare')}>Open comparison →</button>
          </div>
          {!engine ? <Loading text="Loading NASA POWER climate record…" /> : (
            <>
              <div className="kpis">
                <Kpi label="Usual plan" value={<span style={{ fontSize: '1.05rem' }}>{cropEmoji(engine.baseline.crops[0])} {cropName(engine.baseline.crops[0])} → {cropEmoji(engine.baseline.crops[1])} {cropName(engine.baseline.crops[1])}</span>}
                  sub={engine.baseline.budget.status === 'affordable' ? `fits budget (+${fmtMoney(engine.baseline.budget.headroom, scenario.currency)})` : engine.baseline.budget.status === 'unaffordable' ? `over budget by ${fmtMoney(-engine.baseline.budget.headroom, scenario.currency)}` : engine.baseline.budget.status} tone={engine.baseline.budget.status === 'affordable' ? 'ok' : 'bad'} />
                <Kpi label="Best feasible option" value={best ? <span style={{ fontSize: '1.05rem' }}>{cropEmoji(best.crops[0])} {cropName(best.crops[0])} → {cropEmoji(best.crops[1])} {cropName(best.crops[1])}</span> : 'None'} sub={best ? `cash ${fmtMoney(best.budget.totalCash, scenario.currency)} · headroom ${fmtMoney(best.budget.headroom, scenario.currency)}` : 'no plan fits the stated constraints'} tone={best ? 'ok' : 'warn'} />
                <Kpi label="Severe-stress risk" value={`${pct(engine.baseline.outcome.pSevereAny)} → ${best ? pct(best.outcome.pSevereAny) : '—'}`} sub="share of replayed historical season pairs with <50% water-limited yield" />
              </div>
              <hr />
              <div className="mini">
                Region pack <b>{engine.pack.name}</b> · {engine.areaHa.toFixed(2)} ha · {engine.allPlans.length + 1} rotations screened · {engine.excluded.length} excluded with reasons ·
                sowing rule: {engine.window.method === 'rain-onset' ? 'agronomic rain onset (Sivakumar 1988)' : 'soil-warming temperature threshold'}.
              </div>
            </>
          )}
        </div>
        <div className="card">
          <div className="eyebrow">Real NASA evidence at this location</div>
          <h3>Seasons are not average</h3>
          {rows.length ? (
            <>
              <SeasonRainChart rows={rows} highlight={[min!.year, max!.year]} />
              <p className="mini">Season rainfall from NASA POWER PRECTOTCORR ranged from <b>{Math.round(min!.windowRain)} mm ({min!.year})</b> to <b>{Math.round(max!.windowRain)} mm ({max!.year})</b> — a {(max!.windowRain / min!.windowRain).toFixed(1)}× difference. A single “average year” hides that risk.</p>
            </>
          ) : <Loading text="Loading…" />}
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">How it works</div>
        <h2>Four short steps, one transparent pipeline</h2>
        <div className="grid g4 steps" style={{ marginTop: 18 }}>
          {[
            ['Farm & history', 'Location on a map, area, the last 1–3 crops with dates and outcomes, fertilizer records (unknowns stay unknown), soil texture.', 'farm'],
            ['Resources', 'Cash now, reserve, confirmed inflows, irrigation, labor, seed and market constraints, one priority. Edit any price.', 'resources'],
            ['Compare plans', 'Your usual plan versus up to two feasible alternatives: cost, headroom, cash timing, modeled yield range and climate risk — with reasons.', 'compare'],
            ['Evidence', 'NASA climate charts, this season so far, 16-day forecast, satellite layers, past-season review and the soil profile behind every number.', 'evidence'],
          ].map(([t, d, r], i) => (
            <div key={t} className="card" role="button" tabIndex={0} onClick={() => go(r as Route)} style={{ cursor: 'pointer' }}>
              <span className="num">{i + 1}</span>
              <h3>{t}</h3>
              <p className="mini" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section grid g2">
        <div className="card">
          <div className="eyebrow">NASA data used</div>
          <h3>🛰️ From orbit and reanalysis</h3>
          <div className="stack">
            {[
              ['🌧️', 'NASA POWER daily (MERRA-2 / CERES)', 'Rain, Tmax/Tmin, humidity, wind, solar radiation 2001→now; drives FAO-56 ET₀, rain-onset, dry spells, heat days and the water-balance replay.'],
              ['💧', 'NASA POWER GWETROOT / GWETTOP', 'Modeled root-zone and surface soil wetness — compared season-by-season with the 25-year normal.'],
              ['🌿', 'MODIS NDVI 8-day (GIBS)', 'Vegetation greenness around the field: compare this season with the same date last year.'],
              ['🟦', 'SMAP L4 root-zone soil moisture (GIBS)', 'Current regional soil moisture map at ~9 km.'],
              ['☔', 'GPM IMERG precipitation (GIBS)', 'Recent satellite rainfall pattern at ~10 km.'],
              ['🌡️', 'MODIS land-surface temperature (GIBS)', 'Daytime heat across the landscape.'],
            ].map(([i, t, d]) => <div key={t} className="source-tile"><span className="ico">{i}</span><div><b>{t}</b><div className="mini">{d}</div></div></div>)}
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Non-NASA data used</div>
          <h3>👩🏾‍🌾 From the ground and the market</h3>
          <div className="stack">
            {[
              ['📒', 'Farmer records', 'Crop sequence, dates, outcomes, fertilizer product/quantity/area/cost — stored only on this device.'],
              ['💰', 'Budget & local prices', 'Funds, reserve, dated inflows, editable unit prices (seed, fertilizer, labor, machinery, protection, irrigation).'],
              ['🟤', 'ISRIC SoilGrids 2.0', 'Texture, organic carbon, pH, N, CEC at 0–60 cm → available water via Saxton & Rawls (2006). Farmer texture overrides it.'],
              ['📘', 'Regional rule pack', 'Crop calendars, return intervals, disease groups and legume benefits with source IDs and review status.'],
              ['⛅', 'Open-Meteo 16-day forecast', 'Short-term rain, temperature and ET₀ for planting readiness.'],
              ['🗺️', 'OpenStreetMap / Nominatim', 'Base map and place search.'],
            ].map(([i, t, d]) => <div key={t} className="source-tile non"><span className="ico">{i}</span><div><b>{t}</b><div className="mini">{d}</div></div></div>)}
          </div>
        </div>
      </section>

      <section className="section grid g3">
        <div className="card flat"><h3>✅ What it does</h3><p className="mini">Affordable options first; rotation rules with sources; 25-season historical replay of water-limited yield (FAO-56 + FAO-66 Ky); cash timing; honest “no feasible plan” states; works offline after first load.</p></div>
        <div className="card flat"><h3>🚫 What it never claims</h3><p className="mini">No guaranteed yield or profit, no causal diagnosis of a failed crop, no fertilizer dose prescription, no inferred soil N–P–K from purchase history, no forecast presented as certainty.</p></div>
        <div className="card flat"><h3>🔒 Privacy by design</h3><p className="mini">History and budget stay in your browser. Public APIs receive only coordinates. Export, import and delete-all controls are on the Report page. No account needed.</p></div>
      </section>
    </div>
  );
}
