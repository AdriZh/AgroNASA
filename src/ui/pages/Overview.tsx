import { useMemo } from 'react';
import { ArrowRight, Clapperboard, CloudRain, Globe2, Presentation } from 'lucide-react';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import { seasonEndOf } from './season';
import { DEMOS } from '../../state/demo';
import { fmtMoney } from '../../domain/units';
import { yearlyWindow } from '../../weather/indicators';
import { SeasonRainChart } from '../components/charts';
import { CardTitle, Loading, NasaLoading, PlanSkeleton, Tag } from '../components/common';
import { LocationSearch, PresetGrid } from '../components/LocationPicker';
import { OrbitVisual } from '../components/OrbitVisual';
import { WeatherError } from '../components/NetStatus';
import { BEST_FIT, CASH_CAPTION, PlanCard } from './Compare';
import { useDrierHotter } from '../components/stress';
import { setWhatIf } from '../../state/share';
import { WHATIF_NONE } from '../../engine/whatif';

const NASA_SOURCES: [string, string][] = [
  ['NASA POWER daily (MERRA-2 / CERES)', 'Rain, temperature, humidity, wind and sun since 2001 → ET₀, sowing dates, dry spells, heat, water-balance replay.'],
  ['POWER soil wetness + SMAP L4', 'Root-zone wetness against the 25-year normal; soil moisture today against past years.'],
  ['MODIS NDVI, 16-day', 'Season-by-season greenness of your pixel, an independent check of the model.'],
  ['MODIS IGBP land cover', 'Confirms the pin sits on cropland.'],
  ['GRACE / GRACE-FO', 'Groundwater and soil water trend since 2002.'],
  ['NASA EONET + GIBS imagery', 'Fires, floods, storms nearby; IMERG rain, MODIS LST and true-colour maps.'],
];
const GROUND_SOURCES: [string, string][] = [
  ['Farmer records', 'Crop sequence, dates, outcomes and fertilizer, stored only on this device.'],
  ['Budget and local quotes', 'Funds, reserve, dated inflows, editable unit prices.'],
  ['ISRIC SoilGrids 2.0', 'Texture, carbon, pH → water-holding capacity. Your texture overrides it.'],
  ['Regional rule packs', 'Crop calendars, return intervals, disease groups, each with source IDs.'],
  ['FAOSTAT (FAO)', 'Producer prices, exchange rates, nitrogen budgets for 240 countries.'],
  ['Open-Meteo forecast + OpenStreetMap', '16-day forecast for planting readiness; base map and place search.'],
];

export function Overview({ go }: { go: (r: Route) => void }) {
  const { scenario, resetDemo, createNew, engine, data } = useApp();
  const rows = useMemo(() => (data.series && engine ? yearlyWindow(data.series, engine.window.earliest, seasonEndOf(engine)) : []), [data.series, engine]);
  const min = rows.length ? rows.reduce((a, r) => (r.windowRain < a.windowRain ? r : a)) : null;
  const max = rows.length ? rows.reduce((a, r) => (r.windowRain > a.windowRain ? r : a)) : null;
  const best = engine?.alternatives[0];
  const stress = useDrierHotter();
  const cur = scenario.currency;
  const place = (scenario.location.label ?? 'this').split(',')[0];
  const country = (d: (typeof DEMOS)[number]) => d.location.label?.split(',').slice(-1)[0].trim();
  const nSeasons = engine ? Object.values(engine.risks)[0]?.years.length ?? 0 : 0;
  const pickPlace = (p: Parameters<typeof createNew>[0]) => { createNew(p); go('compare'); };

  return (
    <div>
      <section className="card hero" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="caption">NASA Space Apps 2026 · Field Shift challenge</span>
            <h1 id="hero-title" className="display">Which crop next, and can you afford it?</h1>
            <p className="lead">Field Shift replays 25 years of NASA POWER daily weather for your field and ranks the two-season rotations that fit your budget.</p>
            <div className="hero-cta">
              {DEMOS.map((d, i) => (
                <button key={d.id} className={`btn ${i === 0 ? 'primary' : ''}`} onClick={() => { resetDemo(d.id); setWhatIf(WHATIF_NONE); go('compare'); }}>
                  {i === 0 ? `Open ${country(d)} demo` : `${country(d)} demo`}{i === 0 && <ArrowRight />}
                </button>
              ))}
              <button className="btn ghost" onClick={() => { createNew(); go('farm'); }}>Plan my own field</button>
            </div>
          </div>
          <div className="hero-side">
            <div className="hero-art" aria-hidden><OrbitVisual /></div>
            {best ? (
              <>
                <PlanCard p={best} cur={cur} label={BEST_FIT} tone="brand" best compact risk={stress?.get(best.id) ?? null} showNet />
                <p className="mini">{CASH_CAPTION}</p>
                <div className="spread"><span className="mini">{BEST_FIT} for the {place} {scenario.synthetic ? 'demo farm' : 'farm'}</span><button className="btn ghost sm" onClick={() => go('compare')}>All plans <ArrowRight /></button></div>
              </>
            ) : engine ? (
              <div className="card preview"><p className="mini">No plan fits the stated constraints here. Compare shows the smallest change that would help.</p><button className="btn ghost sm" onClick={() => go('compare')}>Open Compare <ArrowRight /></button></div>
            ) : data.weatherStatus === 'error' ? <WeatherError /> : <PlanSkeleton />}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }} aria-label="Why it matters">
        <div className="cols">
          <div>
            <span className="caption">Problem</span>
            <h3>Seasons are not average</h3>
            <span className="mini">{min && max ? `Season rain here ranged ${Math.round(min.windowRain)}–${Math.round(max.windowRain)} mm.` : 'One “average year” hides the bad ones.'}</span>
          </div>
          <div>
            <span className="caption">NASA data</span>
            <h3>{nSeasons || 25} seasons for this grid cell</h3>
            <span className="mini">NASA POWER daily weather (MERRA-2 + CERES), replayed day by day{nSeasons > 1 ? ` as ${nSeasons - 1} consecutive season pairs` : ''}. SMAP, MODIS, IMERG and GRACE add satellite context.</span>
          </div>
          <div>
            <span className="caption">Plan</span>
            <h3>{engine ? `${engine.allPlans.length + 1} rotations screened` : 'Rotations screened'}</h3>
            <span className="mini">{engine ? `${engine.excluded.length} excluded with reasons${best ? `; best fit leaves ${fmtMoney(best.budget.headroom, cur)}` : ''}.` : 'Each excluded with its reason.'}</span>
          </div>
        </div>
      </section>

      <section className="card section" aria-labelledby="where">
        <div className="card-head">
          <div>
            <CardTitle icon={<Globe2 />}><span id="where">Where is your field?</span></CardTitle>
            <p className="mini">Search any place or pick an example region. Field Shift fetches 25 years of NASA data for that grid cell and detects the country, currency and regional farming system.</p>
          </div>
        </div>
        <LocationSearch onPick={pickPlace} />
        <div style={{ marginTop: 16 }}><PresetGrid onPick={pickPlace} /></div>
      </section>

      <section className="card section">
        <div className="card-head"><CardTitle icon={<CloudRain />}>Season rainfall, {place}</CardTitle><Tag t="nasa">NASA POWER</Tag></div>
        {rows.length && min && max ? (
          <>
            <SeasonRainChart rows={rows} highlight={[min.year, max.year]} />
            <p className="chart-cap">Rain in the sowing-to-harvest window per year, mm, NASA POWER {rows[0].year}–{rows[rows.length - 1].year}. Driest {min.year} and wettest {max.year} highlighted: {(max.windowRain / min.windowRain).toFixed(1)}× apart.</p>
          </>
        ) : engine || data.weatherStatus === 'loading' ? <Loading text="Loading NASA POWER…" /> : !engine && data.weatherStatus !== 'error' ? <NasaLoading place={scenario.location.label} variant="block" /> : <p className="mini">No NASA POWER record for this location yet: NASA POWER could not be reached. The two demo farms work offline.</p>}
      </section>

      <section className="card section" aria-labelledby="how">
        <div className="card-head"><h2 id="how">How it works</h2></div>
        <div className="cols">
          {([
            ['Farm & history', 'Pin the field, set the area, add the last crops and fertilizer. Unknowns stay unknown.', 'farm'],
            ['Resources', 'Cash, reserve, inflows, labor, seed and market limits, one priority.', 'resources'],
            ['Compare plans', 'Your usual plan against up to two feasible alternatives, with reasons.', 'compare'],
            ['Evidence', 'NASA climate record, season so far, forecast and satellite layers.', 'evidence'],
          ] as const).map(([t, d, r], i) => (
            <div key={t}>
              <span className="step-n">{String(i + 1).padStart(2, '0')}</span>
              <h3><button className="linkish step-link" onClick={() => go(r)}>{t}</button></h3>
              <span className="mini">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card section" aria-labelledby="sources">
        <div className="card-head"><h2 id="sources">Data sources</h2><button className="btn ghost sm" onClick={() => go('methods')}>Methods & sources <ArrowRight /></button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th style={{ width: '50%' }}><span className="chip nasa">NASA</span> From orbit and reanalysis</th><th>Ground truth: farmer and market</th></tr></thead>
            <tbody>
              {NASA_SOURCES.map(([n, d], i) => (
                <tr key={n}>
                  <td className="wrap" style={{ verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}><b>{n}</b><div className="mini">{d}</div></td>
                  <td className="wrap" style={{ verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>{GROUND_SOURCES[i] && <><b>{GROUND_SOURCES[i][0]}</b><div className="mini">{GROUND_SOURCES[i][1]}</div></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card section" aria-label="What Field Shift does and does not do">
        <div className="cols">
          <div><span className="caption">What it does</span><span className="mini">Affordable options first; sourced rotation rules; NASA POWER replay of water-limited yield over 24 consecutive season pairs (FAO-56 + FAO-66); cash-timing checks; honest “no feasible plan” states. The two demo farms work offline; other locations are cached on the device after the first download.</span></div>
          <div><span className="caption">What it never claims</span><span className="mini">No guaranteed yield or profit, no causal diagnosis of a failed crop, no fertilizer prescription, no soil N–P–K inferred from purchases, no forecast presented as certainty.</span></div>
          <div><span className="caption">Private by design</span><span className="mini">History and budget stay in the browser; public APIs only see coordinates. Export, import and delete-all on the Report page. No account. No LLM in the decision path.</span></div>
        </div>
      </section>

      <section className="card section">
        <div className="present-strip">
          <div><h2>Presenting to judges?</h2><p className="mini">A slide deck and a 30-second narrated video are built in.</p></div>
          <div className="row"><button className="btn" onClick={() => go('pitch')}><Presentation /> Open presentation</button><button className="btn" onClick={() => go('video')}><Clapperboard /> Watch video</button></div>
        </div>
      </section>
    </div>
  );
}
