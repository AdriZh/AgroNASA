import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Route } from '../../App';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, CloudSun, FlaskConical, Globe2, History, Info, LineChart, Ruler, Satellite, Search } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { CROPS, cropName } from '../../data/crops';
import { addDays, diffDays, fmtDate, fmtDayMonth, todayISO } from '../../domain/dates';
import { fmtNum, normalizeApplication } from '../../domain/units';
import { completeYears, cumulativeRain, monthlyClimatology, quantile, rainOnset, windowStats, yearlyWindow, median } from '../../weather/indicators';
import { CumulativeChart, DryHeatChart, FertChart, ForecastChart, MonthlyClimChart, SeasonRainChart } from '../components/charts';
import { MapView } from '../components/MapView';
import { Callout, Kpi, Loading, Ref, Tag } from '../components/common';
import { TEXTURE_LABEL } from '../../soil/soil';
import { SpaceTab, ndviStatement } from './SpaceTab';
import { countryInfo } from '../../data/countries';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { EngineOutput } from '../../engine/plan';
export function seasonEndOf(e: EngineOutput): string {
  if (!e.window.auto) return e.window.method === 'rain-onset' ? '10-31' : '09-15';
  return addDays(`2001-${e.window.earliest}`, 150).slice(5);
}

type Tab = 'climate' | 'space' | 'season' | 'forecast' | 'satellite' | 'past' | 'fertilizer';
const TABS: { id: Tab; label: string; i: ReactNode }[] = [
  { id: 'climate', label: 'Climate record', i: <Globe2 /> }, { id: 'space', label: 'Field from space', i: <Satellite /> }, { id: 'season', label: 'This season so far', i: <LineChart /> }, { id: 'forecast', label: 'Next 16 days', i: <CloudSun /> },
  { id: 'satellite', label: 'Satellite layers', i: <Satellite /> }, { id: 'past', label: 'Past-season review', i: <History /> }, { id: 'fertilizer', label: 'Fertilizer timeline', i: <FlaskConical /> },
];

export function EvidencePage({ go }: { go: (r: Route) => void }) {
  const [tab, setTab] = useState<Tab>('climate');
  const { engine, data } = useApp();
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Step 4 of 4</div>
          <h1>Evidence behind the numbers</h1>
          <p>Observed NASA records, modeled indicators and forecasts are kept separate and labeled. Every chart states its source, grid scale and window.</p>
        </div>
        <div className="row"><button className="btn" onClick={() => go('compare')}><ArrowLeft size={16} /> Plans</button><button className="btn primary" onClick={() => go('report')}>Export report <ArrowRight size={16} /></button></div>
      </div>
      <div className="tabs" role="tablist">{TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.i}{t.label}</button>)}</div>
      {!engine || !data.series ? <Loading text="Loading NASA POWER…" /> : (
        <>
          {tab === 'climate' && <ClimateTab />}
          {tab === 'space' && <SpaceTab />}
          {tab === 'season' && <SeasonTab />}
          {tab === 'forecast' && <ForecastTab />}
          {tab === 'satellite' && <SatelliteTab />}
          {tab === 'past' && <PastTab />}
          {tab === 'fertilizer' && <FertTab />}
        </>
      )}
    </div>
  );
}

function ClimateTab() {
  const { data, engine } = useApp();
  const s = data.series!, w = engine!.window;
  const seasonEnd = seasonEndOf(engine!);
  const clim = useMemo(() => monthlyClimatology(s), [s]);
  const rows = useMemo(() => yearlyWindow(s, w.earliest, seasonEnd), [s, w.earliest, seasonEnd]);
  const years = completeYears(s);
  const annual = clim.reduce((a, m) => a + m.rain, 0), et0 = clim.reduce((a, m) => a + m.et0, 0);
  const seasonMed = median(rows.map((r) => r.windowRain));
  const dry10 = rows.filter((r) => r.longestDry >= 10).length;
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Mean annual rain" value={`${Math.round(annual)} mm`} sub={`${years[0]}–${years[years.length - 1]}, PRECTOTCORR`} />
        <Kpi label="Annual reference ET₀" value={`${Math.round(et0)} mm`} sub="FAO-56 Penman–Monteith" />
        <Kpi label={`Season rain (${fmtDayMonth(`2001-${w.earliest}`)}–${fmtDayMonth(`2001-${seasonEnd}`)})`} value={`${Math.round(seasonMed)} mm`} sub={`median; range ${Math.round(Math.min(...rows.map((r) => r.windowRain)))}–${Math.round(Math.max(...rows.map((r) => r.windowRain)))} mm`} />
        <Kpi label="Years with ≥10-day dry run" value={`${dry10}/${rows.length}`} sub="in this window — depends on window choice" />
        <Kpi label="Elevation · grid" value={`${Math.round(s.meta.elevation)} m`} sub={`${s.meta.lat.toFixed(2)}°, ${s.meta.lon.toFixed(2)}° MERRA-2 cell`} />
      </div>
      <div className="grid g2">
        <div className="card"><div className="card-head"><h3>Monthly climatology</h3><Tag t="nasa" /></div><MonthlyClimChart data={clim} /><p className="mini">Mean of each year’s monthly rainfall sum; ET₀ from POWER temperature, humidity, wind and CERES radiation.</p></div>
        <div className="card"><div className="card-head"><h3>Season rainfall by year</h3><Tag t="nasa" /></div><SeasonRainChart rows={rows} /><p className="mini">Fixed window {fmtDayMonth(`2001-${w.earliest}`)}–{fmtDayMonth(`2001-${seasonEnd}`)}. Rainfall total is not effective rainfall or plant-available water.</p></div>
      </div>
      <div className="card"><div className="card-head"><h3>Dry runs and heat days by year</h3><Tag t="nasa" /></div><DryHeatChart rows={rows} /><p className="mini">Longest run with &lt;1 mm/day, reset at the window edge (exploratory threshold, not drought injury). Hot days: Tmax ≥ 35 °C (exploratory).</p></div>
      <CountryContext />
      <div className="card"><h3>Data provenance</h3>
        <div className="mini" style={{ wordBreak: 'break-all' }}><b>Query:</b> <a href={s.meta.query} target="_blank" rel="noreferrer">{s.meta.query}</a></div>
        <div className="mini"><b>Retrieved:</b> {fmtDate(s.meta.retrievedAt.slice(0, 10))} · <b>Sources:</b> {s.meta.sources.join(', ')} · <b>Time standard:</b> LST · <b>Records:</b> {s.n} days · <b>Status:</b> {data.weatherOrigin === 'bundled' ? 'archived snapshot bundled with the app (works offline)' : data.weatherOrigin === 'cache' ? 'cached on this device' : 'live'}</div>
        <div className="row" style={{ marginTop: 6 }}><Ref id="R5" /><Ref id="R6" /><Ref id="R17" /><Ref id="R8" /></div>
      </div>
    </div>
  );
}

function SeasonTab() {
  const { data, engine, scenario } = useApp();
  const s = data.series!, w = engine!.window;
  let year = Number(s.meta.end.slice(0, 4));
  if (`${year}-${w.earliest}` > s.meta.end) year--;
  const len = w.method === 'rain-onset' ? 160 : 130;
  const years = completeYears(s).filter((y) => y !== year);
  const curves = years.map((y) => cumulativeRain(s, y, w.earliest, len));
  const cur = cumulativeRain(s, year, w.earliest, len);
  const chart = Array.from({ length: len }, (_, k) => {
    const vals = curves.map((c) => c[k]).filter((v): v is number => v != null);
    const p20 = quantile(vals, 0.2), p80 = quantile(vals, 0.8);
    return { day: fmtDayMonth(addDays(`${year}-${w.earliest}`, k)), p20, p80, band: [p20, p80] as [number, number], median: quantile(vals, 0.5), current: cur[k] };
  });
  const lastK: number = cur.reduce<number>((a, v, k) => (v != null ? k : a), -1);
  const curTotal = lastK >= 0 ? cur[lastK]! : null;
  const medAt = lastK >= 0 ? chart[lastK].median : null;
  const onset = rainOnset(s, year, w.earliest, w.latest);
  const end = s.meta.end, start30 = addDays(end, -29);
  const gw = windowStats(s, start30, end).meanGwetRoot;
  const gwNorm = median(years.map((y) => windowStats(s, `${y}${start30.slice(4)}`, `${y}${end.slice(4)}`).meanGwetRoot ?? NaN).filter(Number.isFinite));
  const lag = diffDays(end, todayISO());
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label={`Rain since ${fmtDayMonth(`2001-${w.earliest}`)} ${year}`} value={curTotal != null ? `${Math.round(curTotal)} mm` : '—'} sub={medAt != null ? `median year at this date: ${Math.round(medAt)} mm` : ''} tone={curTotal != null && medAt != null ? (curTotal < chart[lastK].p20 ? 'bad' : curTotal > chart[lastK].p80 ? 'ok' : undefined) : undefined} />
        {w.method === 'rain-onset' && <Kpi label={`Agronomic onset ${year}`} value={onset.date ? fmtDayMonth(onset.date) : 'not detected'} sub={`${onset.falseStarts} false start(s) · Sivakumar criterion`} />}
        <Kpi label="Root-zone soil wetness (last 30 d)" value={gw != null ? gw.toFixed(2) : '—'} sub={`normal ${Number.isFinite(gwNorm) ? gwNorm.toFixed(2) : '—'} · NASA MERRA-2 GWETROOT`} tone={gw != null && Number.isFinite(gwNorm) ? (gw < gwNorm - 0.04 ? 'warn' : undefined) : undefined} />
        <Kpi label="Latest NASA day" value={fmtDayMonth(end)} sub={`${lag} days behind today (near-real-time lag)`} />
      </div>
      <div className="card">
        <div className="card-head"><h3>Cumulative rainfall: {year} vs {years[0]}–{years[years.length - 1]}</h3><Tag t="nasa" /></div>
        <CumulativeChart data={chart} year={year} />
        <p className="mini">Use this to see whether the current season is running dry or wet. It describes what has happened; it does not forecast the rest of the season. {scenario.history.some((h) => h.year === year) ? 'Your reported crop this year is reviewed in “Past-season review”.' : ''}</p>
      </div>
    </div>
  );
}

function ForecastTab() {
  const { forecast, engine } = useApp();
  useEffect(() => { forecast.load(); }, [forecast.load]); // eslint-disable-line
  if (forecast.status === 'loading' || forecast.status === 'idle') return <Loading text="Fetching 16-day forecast (Open-Meteo)…" />;
  if (forecast.status === 'error' || !forecast.data) return <Callout tone="warn">Forecast unavailable ({forecast.error}). This panel needs a network connection; everything else works offline.</Callout>;
  const d = forecast.data.days;
  const rain = d.reduce((a, x) => a + x.rain, 0), et = d.reduce((a, x) => a + x.et0, 0);
  const frost = d.filter((x) => x.tmin <= 0).length, hot = d.filter((x) => x.tmax >= 35).length;
  let onsetLike: string | null = null;
  for (let i = 0; i + 2 < d.length; i++) if (d[i].rain + d[i + 1].rain + d[i + 2].rain >= 20) { onsetLike = d[i].date; break; }
  const today = todayISO();
  const md = today.slice(5);
  const within = (x: { earliest: string; latest: string }) => (x.latest >= x.earliest ? md >= x.earliest && md <= x.latest : md >= x.earliest || md <= x.latest);
  const w = engine!.windows.find(within) ?? engine!.windows.find((x) => x.earliest > md) ?? engine!.window;
  const y = Number(today.slice(0, 4));
  const inWindow = within(w);
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Rain next 16 days" value={`${Math.round(rain)} mm`} />
        <Kpi label="ET₀ next 16 days" value={`${Math.round(et)} mm`} sub={`water balance ${rain - et >= 0 ? '+' : ''}${Math.round(rain - et)} mm`} tone={rain - et < -30 ? 'warn' : undefined} />
        <Kpi label="Frost nights / hot days" value={`${frost} / ${hot}`} sub="Tmin ≤ 0 °C / Tmax ≥ 35 °C" />
        <Kpi label="Sowing-rain signal" value={onsetLike ? fmtDayMonth(onsetLike) : 'none'} sub="3-day rain ≥ 20 mm in forecast" tone={onsetLike ? 'ok' : undefined} />
      </div>
      <div className="card"><div className="card-head"><h3>16-day outlook</h3><Tag t="forecast" /></div><ForecastChart days={d} />
        <Callout tone={inWindow ? 'ok' : 'info'}>{inWindow ? `You are inside the ${w.label.toLowerCase()} sowing window (${fmtDayMonth(`${y}-${w.earliest}`)}–${fmtDayMonth(`${y}-${w.latest}`)}). ${onsetLike ? 'The forecast shows rain that could meet the onset criterion — confirm with a soil check (moist to ~10 cm) and watch for a dry spell afterwards.' : 'No onset-strength rain is forecast yet.'}` : `The sowing window (${fmtDayMonth(`${y}-${w.earliest}`)}–${fmtDayMonth(`${y}-${w.latest}`)}) is not open now. Use this panel for field operations; seasonal planning relies on the NASA historical replay.`}</Callout>
        <p className="mini" style={{ marginTop: 8 }}>Open-Meteo numerical forecast retrieved {fmtDate(forecast.data.retrievedAt.slice(0, 10))}. Skill drops sharply after ~7 days; this is not NASA data. <Ref id="R26" /></p>
      </div>
    </div>
  );
}

function SatelliteTab() {
  const { scenario: sc } = useApp();
  return (
    <div className="card">
      <div className="card-head"><h3>NASA satellite layers around your field</h3><Tag t="nasa">NASA GIBS</Tag></div>
      <p className="mini">Choose a layer and date. Compare the same date last year with “−1 year”. Colour-mapped imagery for orientation; values are not extracted at the field point.</p>
      <MapView lat={sc.location.lat} lon={sc.location.lon} tall defaultLayer="ndvi" zoom={9} />
      <div className="row" style={{ marginTop: 8 }}><Ref id="R22" /><Ref id="R23" /><Ref id="R24" /><Ref id="R25" /></div>
    </div>
  );
}

function PastTab() {
  const { reviews, scenario: sc, space } = useApp();
  useEffect(() => { space.load(); }, [space.load]); // eslint-disable-line
  const peaks = space.data?.ndvi.years.map((y) => ({ year: y.year, peak: y.peak })) ?? [];
  if (!reviews.length) return <Callout tone="info">Add crop history with years on the Farm page to review past seasons against the NASA record.</Callout>;
  return (
    <div className="stack">
      <Callout tone="info">Possible weather-related stresses only — <b>not a diagnosis</b> of why a crop did well or badly. Field water status, crop stages, pests and management were not measured.</Callout>
      {reviews.map((r) => (
        <div key={r.season.id} className="card">
          <div className="card-head">
            <div><span className="tl-year">{r.season.year}</span> &nbsp; <b>{CROPS[r.season.cropId]?.emoji} {cropName(r.season.cropId)}</b> <span className="mini">· {fmtDate(r.start)} → {fmtDate(r.end)}{r.datesEstimated ? ' (estimated)' : r.season.approximateDate ? ' (approximate)' : ''}</span></div>
            <div className="row">{r.season.outcome && <span className={`badge ${r.season.outcome === 'good' ? 'ok' : r.season.outcome === 'poor' || r.season.outcome === 'failed' ? 'bad' : 'info'}`}>Reported: {r.season.outcome}</span>}<Tag t="nasa" /><Tag t="modeled" /></div>
          </div>
          <div className="kpis" style={{ marginBottom: 10 }}>
            <Kpi label="Rain in period" value={r.rain != null ? `${Math.round(r.rain)} mm` : '—'} sub={`median ${Math.round(r.rainMedian)} mm · percentile ${Math.round(r.rainPct * 100)}`} />
            <Kpi label="Longest dry run" value={r.dryRun ? `${r.dryRun.days} d` : '—'} sub={r.dryRun ? `from ${fmtDayMonth(r.dryRun.start)}` : ''} />
            <Kpi label="Heat days at flowering" value={r.heatDays} sub={`Tmax ≥ ${CROPS[r.season.cropId]?.heatThresholdC} °C`} />
            <Kpi label="Modeled water-limited yield" value={r.relYield != null ? `${Math.round(r.relYield * 100)}%` : '—'} sub="of attainable (FAO-56/66)" />
          </div>
          {r.statements.map((st, i) => (
            <div key={i} className="statement"><span className={`k ${st.tone}`}>{st.tone === 'warn' ? <AlertTriangle /> : st.tone === 'ok' ? <CheckCircle2 /> : st.kind === 'limit' ? <Ruler /> : st.kind === 'fertilizer' ? <FlaskConical /> : st.kind === 'check' ? <Search /> : <Info />}</span><span>{st.text} <span className="refs">{st.refs.slice(0, 2).map((x) => <Ref key={x} id={x} />)}</span></span></div>
          ))}
          {(() => { const n = ndviStatement(peaks, r.season.year); return n ? <div className="statement"><span className={`k ${n.tone}`}><Satellite /></span><span>{n.text} <span className="refs"><Ref id="R24" /><Ref id="R35" /></span></span></div> : space.status === 'loading' ? <div className="mini" style={{ marginTop: 4 }}>Loading MODIS greenness for this season…</div> : null; })()}
          {r.season.notes && <p className="mini" style={{ marginTop: 6 }}>Farmer note: “{r.season.notes}”</p>}
        </div>
      ))}
      <p className="mini">Season records for {sc.name}. Allowed wording follows the planning pack: “may have contributed”, “no clear weather explanation was found”.</p>
    </div>
  );
}

function FertTab() {
  const { scenario: sc } = useApp();
  const hist = [...sc.history].sort((a, b) => a.year - b.year);
  const rows = hist.map((h) => {
    const apps = sc.fertilizer.filter((f) => f.cropSeasonId === h.id).map(normalizeApplication);
    const sum = (k: 'nKgHa' | 'p2o5KgHa' | 'k2oKgHa') => (apps.length && apps.every((a) => a[k] != null) ? apps.reduce((x, a) => x + (a[k] ?? 0), 0) : apps.some((a) => a[k] != null) ? apps.reduce((x, a) => x + (a[k] ?? 0), 0) : null);
    return { label: `${h.year} ${cropName(h.cropId)}`, n: sum('nKgHa'), p2o5: sum('p2o5KgHa'), k2o: sum('k2oKgHa'), count: apps.length, unknown: apps.filter((a) => a.nKgHa == null).length };
  });
  return (
    <div className="grid g2">
      <div className="card"><div className="card-head"><h3>Applied nutrients by season (label arithmetic)</h3><Tag t="farmer" /></div><FertChart rows={rows} />
        <p className="mini">kg per treated hectare = product kg ÷ treated ha × label %. Not plant-available nutrients, uptake or present soil status. P₂O₅ and K₂O kept in label convention (P = P₂O₅ × 0.4364; K = K₂O × 0.8301).</p></div>
      <div className="card"><h3>Records</h3>
        <div className="table-wrap"><table><thead><tr><th>Season</th><th className="num">Records</th><th className="num">N</th><th className="num">P₂O₅</th><th className="num">K₂O</th><th>Unknown</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td className="num">{r.count}</td><td className="num">{fmtNum(r.n, 1)}</td><td className="num">{fmtNum(r.p2o5, 1)}</td><td className="num">{fmtNum(r.k2o, 1)}</td><td>{r.count === 0 ? 'no record (≠ none applied)' : r.unknown ? `${r.unknown} with unknown amount/area/analysis` : '—'}</td></tr>)}</tbody></table></div>
        {(() => { const c = countryInfo(sc.countryIso2); const n = c?.nutrients; return n ? <Callout tone="info">National context ({c!.name}, FAOSTAT {c!.nutrientsYear}): cropland receives on average <b>{n.nMineralKgHa ?? '—'} kg/ha mineral N</b> + {n.nManureKgHa ?? '—'} kg/ha manure N; nitrogen balance {n.nBalanceKgHa != null ? `${n.nBalanceKgHa > 0 ? '+' : ''}${n.nBalanceKgHa}` : '—'} kg/ha, use efficiency {n.nUsePct ?? '—'}%. National averages — not your field. <Ref id="R33" /></Callout> : null; })()}
        <p className="mini" style={{ marginTop: 8 }}>Soil context: {sc.soil.texture !== 'unknown' ? TEXTURE_LABEL[sc.soil.texture] : 'texture from SoilGrids'}{sc.soil.labPh ? ` · lab pH ${sc.soil.labPh}` : ''}. A soil test is the right basis for any fertilizer decision. <Ref id="R7" /></p>
      </div>
    </div>
  );
}


function CountryContext() {
  const { scenario: sc } = useApp();
  const c = countryInfo(sc.countryIso2);
  if (!c) return null;
  const series = Object.entries(c.warming?.series ?? {}).map(([y, v]) => ({ year: Number(y), v }));
  const n = c.nutrients;
  return (
    <div className="card">
      <div className="card-head"><h3>Country context · {c.name}</h3><span className="chip">FAOSTAT</span></div>
      <div className="kpis">
        {c.warming && <Kpi label="Warming vs 1951–80" value={`${c.warming.meanC > 0 ? '+' : ''}${c.warming.meanC.toFixed(2)} °C`} sub={`mean ${c.warming.from}–${c.warming.to}, FAOSTAT ET (NASA GISTEMP-based)`} tone={c.warming.meanC > 1.5 ? 'warn' : undefined} />}
        {n && <Kpi label="Cropland N balance" value={n.nBalanceKgHa != null ? `${n.nBalanceKgHa > 0 ? '+' : ''}${n.nBalanceKgHa} kg/ha` : '—'} sub={`mineral N ${n.nMineralKgHa ?? '—'} · manure N ${n.nManureKgHa ?? '—'} kg/ha (${c.nutrientsYear})`} />}
        {n?.nUsePct != null && <Kpi label="N use efficiency" value={`${n.nUsePct}%`} sub="outputs ÷ inputs; >100% = soil N mining" tone={n.nUsePct > 100 ? 'warn' : undefined} />}
        <Kpi label="Currency & FX" value={c.currency ?? '—'} sub={`${c.lcuPerUsd?.toLocaleString('en-US', { maximumFractionDigits: 2 })} per USD (${c.fxYear}) · ${Object.keys(c.prices).length} crop producer prices`} />
      </div>
      {series.length > 5 && (
        <div style={{ marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#8a94a6' }} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#8a94a6' }} unit="°" />
              <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} °C`} />
              <Bar isAnimationActive={false} dataKey="v" name="Annual temperature change" radius={[2, 2, 0, 0]}>{series.map((x) => <Cell key={x.year} fill={x.v > 0 ? '#ef4444' : '#3b82f6'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mini" style={{ margin: 0 }}>National statistics give context only; the plan itself uses NASA data for your grid cell. <Ref id="R33" /></p>
    </div>
  );
}
