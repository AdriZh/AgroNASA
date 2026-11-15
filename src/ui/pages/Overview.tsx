import { useMemo } from 'react';
import {
  ArrowRight, Globe2, BadgeCheck, Ban, Bot, Calculator, Clapperboard, CloudRain, CloudSun, Droplets, Flame, Leaf, Lock, Map as MapIcon, Microscope, NotebookPen, Plus, Presentation, Satellite, Scale, Shovel, BookMarked, Wallet, Wheat,
} from 'lucide-react';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import { seasonEndOf } from './season';
import { DEMOS } from '../../state/demo';
import { cropEmoji, cropName } from '../../data/crops';
import { fmtMoney } from '../../domain/units';
import { yearlyWindow } from '../../weather/indicators';
import { SeasonRainChart } from '../components/charts';
import { CardTitle, Loading, NasaLoading, pct } from '../components/common';
import { LocationSearch, PresetGrid } from '../components/LocationPicker';
import { WeatherError } from '../components/NetStatus';
import { OrbitVisual } from '../components/OrbitVisual';

export function Overview({ go }: { go: (r: Route) => void }) {
  const { scenario, resetDemo, createNew, engine, data } = useApp();
  const rows = useMemo(() => (data.series && engine ? yearlyWindow(data.series, engine.window.earliest, seasonEndOf(engine)) : []), [data.series, engine]);
  const min = rows.length ? rows.reduce((a, r) => (r.windowRain < a.windowRain ? r : a)) : null;
  const max = rows.length ? rows.reduce((a, r) => (r.windowRain > a.windowRain ? r : a)) : null;
  const best = engine?.alternatives[0];
  const cur = scenario.currency;

  return (
    <div>
      <section className="hero">
        <div className="stars" />
        <div className="hero-grid">
          <div style={{ position: 'relative' }}>
            <div className="hero-badges">
              <span><Satellite size={13} /> NASA POWER · SMAP · MODIS · IMERG</span>
              <span><BadgeCheck size={13} /> Space Apps 2026 · Field Shift</span>
            </div>
            <h1>Plan the next two seasons with <span className="grad">25 years of NASA Earth data</span> — and the money you actually have.</h1>
            <p className="lead">Field Shift combines satellite climate history with what the farmer knows — past crops, fertilizer, soil, budget, labor and markets — to compare crop-rotation plans they can afford, with the climate risk and the reason behind every option.</p>
            <div className="cta">
              {DEMOS.map((d) => <button key={d.id} className="btn light lg" onClick={() => { resetDemo(d.id); go('compare'); }}><Wheat size={17} /> {d.location.label?.split(',').slice(-1)[0].trim()} demo</button>)}
              <button className="btn glass lg" onClick={() => { createNew(); go('farm'); }}><Plus size={17} /> Plan my farm</button>
              <button className="btn glass lg" onClick={() => go('video')}><Clapperboard size={17} /> 30-s video</button>
            </div>
          </div>
          <div className="hero-visual"><OrbitVisual /></div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow"><Globe2 size={13} /> Plan anywhere on Earth</div>
              <h2 style={{ margin: 0 }}>Where is your field?</h2>
              <p className="mini" style={{ margin: '4px 0 0' }}>Search any place or pick an example region. Field Shift fetches 25 years of NASA data for that grid cell, detects the country (currency + FAOSTAT prices) and the regional farming system — 14 regional packs plus a global fallback.</p>
            </div>
          </div>
          <LocationSearch onPick={(p) => { createNew(p); go('compare'); }} />
          <div style={{ marginTop: 14 }}><PresetGrid onPick={(p) => { createNew(p); go('compare'); }} /></div>
        </div>
      </section>

      <section className="section grid g-side">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Current scenario</div>
              <h2 style={{ margin: 0 }}>{scenario.name}</h2>
            </div>
            <button className="btn primary" onClick={() => go('compare')}>Open comparison <ArrowRight size={16} /></button>
          </div>
          {!engine ? (data.weatherStatus === 'error' ? <WeatherError /> : <NasaLoading place={scenario.location.label} />) : (
            <>
              <div className="grid g3" style={{ gap: 12 }}>
                <div className="card flat" style={{ padding: 16 }}>
                  <div className="kpi"><span className="l">Usual plan</span></div>
                  <div className="seq" style={{ fontSize: '.95rem', margin: '8px 0' }}>{cropEmoji(engine.baseline.crops[0])} {cropName(engine.baseline.crops[0])} <ArrowRight size={14} color="var(--ink-3)" /> {cropEmoji(engine.baseline.crops[1])} {cropName(engine.baseline.crops[1])}</div>
                  <span className={`badge ${engine.baseline.budget.status === 'affordable' ? 'ok' : 'bad'}`}>{engine.baseline.budget.status === 'affordable' ? `Fits · +${fmtMoney(engine.baseline.budget.headroom, cur)}` : engine.baseline.budget.status === 'unaffordable' ? `Over by ${fmtMoney(-engine.baseline.budget.headroom, cur)}` : engine.baseline.budget.status}</span>
                </div>
                <div className="card flat" style={{ padding: 16, background: 'linear-gradient(180deg,#ecfdf5,#fff)', borderColor: '#a7f3d0' }}>
                  <div className="kpi"><span className="l" style={{ color: 'var(--brand)' }}>Best feasible option</span></div>
                  {best ? <>
                    <div className="seq" style={{ fontSize: '.95rem', margin: '8px 0' }}>{cropEmoji(best.crops[0])} {cropName(best.crops[0])} <ArrowRight size={14} color="var(--ink-3)" /> {cropEmoji(best.crops[1])} {cropName(best.crops[1])}</div>
                    <span className="badge ok">Fits · +{fmtMoney(best.budget.headroom, cur)}</span>
                  </> : <p className="mini" style={{ marginTop: 8 }}>No plan fits the stated constraints — see Compare for the smallest change that would help.</p>}
                </div>
                <div className="card flat" style={{ padding: 16 }}>
                  <div className="kpi"><span className="l">Severe-stress risk</span><span className="v">{pct(engine.baseline.outcome.pSevereAny)} <span style={{ color: 'var(--ink-3)', fontSize: '1rem' }}>→</span> <span style={{ color: 'var(--brand)' }}>{best ? pct(best.outcome.pSevereAny) : '—'}</span></span><span className="s">share of replayed past season pairs below 50% water-limited yield</span></div>
                </div>
              </div>
              <div className="row mini" style={{ marginTop: 14, gap: 16 }}>
                <span><b>{engine.allPlans.length + 1}</b> rotations screened</span>
                <span><b>{engine.excluded.length}</b> excluded with reasons</span>
                <span><b>{Object.values(engine.risks)[0]?.years.length}</b> NASA seasons replayed</span>
                <span>{engine.areaHa.toFixed(2)} ha · {engine.pack.short}</span>
              </div>
            </>
          )}
        </div>
        <div className="card">
          <div className="card-head"><CardTitle icon={<CloudRain size={17} />} tone="sky">Seasons are not average</CardTitle><span className="chip nasa"><Satellite /> NASA POWER</span></div>
          {rows.length ? (
            <>
              <SeasonRainChart rows={rows} highlight={[min!.year, max!.year]} />
              <p className="mini" style={{ margin: 0 }}>Season rainfall here ranged from <b>{Math.round(min!.windowRain)} mm ({min!.year})</b> to <b>{Math.round(max!.windowRain)} mm ({max!.year})</b> — {(max!.windowRain / min!.windowRain).toFixed(1)}×. A single “average year” hides that risk.</p>
            </>
          ) : data.weatherStatus === 'error' ? <p className="mini">No NASA POWER record for this location yet: NASA POWER could not be reached. The two demo farms work offline.</p> : <Loading text="Loading…" />}
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">How it works</div>
        <h2>Four short steps. One transparent pipeline.</h2>
        <div className="grid g4 steps" style={{ marginTop: 16 }}>
          {([
            [<MapIcon size={18} />, 'Farm & history', 'Pin the field, set the area, add the last 1–3 crops and fertilizer records. Unknowns stay unknown.', 'farm'],
            [<Wallet size={18} />, 'Resources', 'Cash, reserve, confirmed inflows, irrigation, labor, seed and market limits, one priority. Edit any price.', 'resources'],
            [<Scale size={18} />, 'Compare plans', 'Usual plan vs up to two feasible alternatives: cost, headroom, cash timing, modeled yield and climate risk.', 'compare'],
            [<Microscope size={18} />, 'Evidence', 'NASA climate, season-so-far, forecast, satellite layers and an honest past-season review.', 'evidence'],
          ] as const).map(([icon, t, d, r], i) => (
            <button key={t} className="card hover" onClick={() => go(r as Route)} style={{ textAlign: 'left', cursor: 'pointer' }}>
              <div className="spread"><span className="step-num">{i + 1}</span><span className="ic sky">{icon}</span></div>
              <h3>{t}</h3>
              <p className="mini" style={{ margin: 0 }}>{d}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="section grid g2">
        <div className="card">
          <div className="eyebrow"><Satellite size={13} /> NASA data</div>
          <h3 style={{ marginBottom: 10 }}>From orbit and reanalysis</h3>
          {([
            [<CloudRain size={18} />, 'NASA POWER daily (MERRA-2 / CERES)', 'Rain, Tmax/Tmin, humidity, wind, solar radiation 2001→now for any point on Earth → ET₀, sowing dates, dry spells, heat, water-balance replay.'],
            [<Droplets size={18} />, 'POWER soil wetness + SMAP L4 soil moisture', 'Root-zone wetness vs the 25-year normal, and SMAP soil moisture today vs the same date in past years.'],
            [<Leaf size={18} />, 'MODIS NDVI 16-day at your field (2000→now)', 'Season-by-season greenness of your pixel — and an independent check of the water-balance model.'],
            [<MapIcon size={18} />, 'MODIS IGBP land cover', 'Confirms the pin sits on cropland.'],
            [<Droplets size={18} />, 'GRACE / GRACE-FO water storage', 'Groundwater + soil water trend since 2002 — is irrigation sustainable here?'],
            [<Flame size={18} />, 'NASA EONET + GIBS imagery', 'Wildfires, floods, storms and dust nearby; IMERG rain, MODIS LST and true colour maps.'],
          ] as const).map(([i, t, d]) => <div key={t} className="source-tile"><span className="ico">{i}</span><div><b>{t}</b><div className="mini">{d}</div></div></div>)}
        </div>
        <div className="card">
          <div className="eyebrow" style={{ color: 'var(--soil)' }}><NotebookPen size={13} /> Ground truth</div>
          <h3 style={{ marginBottom: 10 }}>From the farmer and the market</h3>
          {([
            [<NotebookPen size={18} />, 'Farmer records', 'Crop sequence, dates, outcomes, fertilizer product/quantity/area/cost — stored only on this device.'],
            [<Wallet size={18} />, 'Budget & local quotes', 'Funds, reserve, dated inflows, editable unit prices for every input.'],
            [<Shovel size={18} />, 'ISRIC SoilGrids 2.0', 'Texture, carbon, pH, N, CEC → water-holding capacity (Saxton & Rawls). Farmer texture overrides it.'],
            [<BookMarked size={18} />, 'Regional rule packs', 'Crop calendars, return intervals, disease groups, legume benefits — each with source IDs and review status.'],
            [<Wallet size={18} />, 'FAOSTAT (FAO)', 'Real producer prices, exchange rates, cropland nitrogen budgets and warming for 240 countries.'],
            [<CloudSun size={18} />, 'Open-Meteo 16-day forecast', 'Short-term rain, temperature and ET₀ for planting readiness.'],
            [<MapIcon size={18} />, 'OpenStreetMap / Nominatim', 'Base map and place search.'],
          ] as const).map(([i, t, d]) => <div key={t} className="source-tile non"><span className="ico">{i}</span><div><b>{t}</b><div className="mini">{d}</div></div></div>)}
        </div>
      </section>

      <section className="section grid g3">
        <div className="card"><CardTitle icon={<Calculator size={17} />}>What it does</CardTitle><p className="mini" style={{ margin: 0 }}>Affordable options first; sourced rotation rules; 25-season replay of water-limited yield (FAO-56 + FAO-66); cash-timing checks; honest “no feasible plan” states; works offline after first load.</p></div>
        <div className="card"><CardTitle icon={<Ban size={17} />} tone="red">What it never claims</CardTitle><p className="mini" style={{ margin: 0 }}>No guaranteed yield or profit, no causal diagnosis of a failed crop, no fertilizer prescription, no soil N–P–K inferred from purchases, no forecast presented as certainty.</p></div>
        <div className="card"><CardTitle icon={<Lock size={17} />} tone="sky">Private by design</CardTitle><p className="mini" style={{ margin: 0 }}>History and budget stay in the browser; public APIs only see coordinates. Export, import and delete-all on the Report page. No account. <Bot size={12} /> No LLM in the decision path.</p></div>
      </section>

      <section className="section">
        <div className="card" style={{ background: 'linear-gradient(120deg,#070d1a,#0d1f3c)', color: '#fff', border: 0 }}>
          <div className="spread">
            <div><h2 style={{ color: '#fff', margin: 0 }}>Presenting to judges?</h2><p style={{ color: '#c3cee0', margin: '6px 0 0' }}>An animated explainer deck and a 30-second narrated video are built in.</p></div>
            <div className="row"><button className="btn light" style={{ background: '#fff', color: '#070d1a', border: 0 }} onClick={() => go('pitch')}><Presentation size={16} /> Open presentation</button><button className="btn" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'rgba(255,255,255,.18)' }} onClick={() => go('video')}><Clapperboard size={16} /> Watch video</button></div>
          </div>
        </div>
      </section>
    </div>
  );
}
