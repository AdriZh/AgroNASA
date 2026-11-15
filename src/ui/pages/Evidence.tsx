import { useEffect, useMemo, useState } from 'react';
import type { Route } from '../../App';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FlaskConical, Info, Ruler, Satellite, Search } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { CROPS, cropName } from '../../data/crops';
import { addDays, diffDays, fmtDate, fmtDayMonth, todayISO } from '../../domain/dates';
import { fmtNum, normalizeApplication } from '../../domain/units';
import { completeYears, cumulativeRain, monthlyClimatology, quantile, rainOnset, windowStats, yearlyWindow, median } from '../../weather/indicators';
import { axisProps, CumulativeChart, DryHeatChart, FertChart, ForecastChart, gridProps, MonthlyClimChart, SeasonRainChart, tipProps, useChartHeight, useChartTheme, xAxisProps } from '../components/charts';
import { MapView } from '../components/MapView';
import { Callout, Kpi, KpiStrip, Loading, Ref, Seg, StatRows, Tag } from '../components/common';
import { TEXTURE_LABEL } from '../../soil/soil';
import { SpaceTab, ndviStatement } from './SpaceTab';
import { countryInfo } from '../../data/countries';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { EngineOutput } from '../../engine/plan';
export function seasonEndOf(e: EngineOutput): string {
  if (!e.window.auto) return e.window.method === 'rain-onset' ? '10-31' : '09-15';
  return addDays(`2001-${e.window.earliest}`, 150).slice(5);
}

type Tab = 'climate' | 'space' | 'season' | 'forecast' | 'satellite' | 'past' | 'fertilizer';
const TABS: { v: Tab; label: string }[] = [
  { v: 'climate', label: 'Climate' }, { v: 'space', label: 'Field' }, { v: 'season', label: 'This season' }, { v: 'forecast', label: 'Forecast' },
  { v: 'satellite', label: 'Layers' }, { v: 'past', label: 'Review' }, { v: 'fertilizer', label: 'Fertilizer' },
];

export function EvidencePage({ go }: { go: (r: Route) => void }) {
  const [tab, setTab] = useState<Tab>('climate');
  const { engine, data } = useApp();
  return (
    <div>
      <div className="page-head">
        <div>
          <span className="caption">Step 4 of 4</span>
          <h1>Evidence behind the numbers</h1>
          <p>Observed NASA records, modeled indicators and forecasts are kept separate and labeled. Every chart states its source, grid scale and window.</p>
        </div>
        <div className="page-actions"><button className="btn" onClick={() => go('compare')}><ArrowLeft /> Plans</button><button className="btn primary" onClick={() => go('report')}>Export report <ArrowRight /></button></div>
      </div>
      <div style={{ marginBottom: 24 }}><Seg label="Evidence" role="tablist" value={tab} options={TABS} onChange={setTab} /></div>
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
      <KpiStrip>
        <Kpi label="Annual rain" value={<>{Math.round(annual)}<span className="unit">mm</span></>} sub={`mean ${years[0]}–${years[years.length - 1]}`} />
        <Kpi label="Annual ET₀" value={<>{Math.round(et0)}<span className="unit">mm</span></>} sub="FAO-56 Penman–Monteith" />
        <Kpi label="Season rain" value={<>{Math.round(seasonMed)}<span className="unit">mm</span></>} sub={`median ${fmtDayMonth(`2001-${w.earliest}`)}–${fmtDayMonth(`2001-${seasonEnd}`)}; range ${Math.round(Math.min(...rows.map((r) => r.windowRain)))}–${Math.round(Math.max(...rows.map((r) => r.windowRain)))}`} />
        <Kpi label="Dry-run years" value={`${dry10} of ${rows.length}`} sub="with a ≥10-day dry run in this window" />
        <Kpi label="Elevation" value={<>{Math.round(s.meta.elevation)}<span className="unit">m</span></>} sub={<span className="mono">{s.meta.lat.toFixed(2)}°, {s.meta.lon.toFixed(2)}° · MERRA-2 cell</span>} />
      </KpiStrip>
      <div className="grid g2">
        <div className="card"><div className="card-head"><h3>Monthly climatology</h3><Tag t="nasa" /></div><MonthlyClimChart data={clim} /><p className="chart-cap">Mean of each year’s monthly sum, NASA POWER {years[0]}–{years[years.length - 1]}; ET₀ from POWER temperature, humidity, wind and CERES radiation.</p></div>
        <div className="card"><div className="card-head"><h3>Season rainfall by year</h3><Tag t="nasa" /></div><SeasonRainChart rows={rows} height={220} /><p className="chart-cap">Rain {fmtDayMonth(`2001-${w.earliest}`)}–{fmtDayMonth(`2001-${seasonEnd}`)} per year, mm, NASA POWER. A rainfall total is not effective rainfall or plant-available water.</p></div>
      </div>
      <div className="card"><div className="card-head"><h3>Dry runs and heat days by year</h3><Tag t="nasa" /></div><DryHeatChart rows={rows} /><p className="chart-cap">Days per year, NASA POWER. Longest run with &lt;1 mm/day, reset at the window edge (exploratory threshold, not drought injury). Hot days: Tmax ≥ 35 °C (exploratory).</p></div>
      <CountryContext />
      <div className="card"><div className="card-head"><h3>Data provenance</h3><div className="chips"><Ref id="R5" /><Ref id="R6" /><Ref id="R17" /><Ref id="R8" /></div></div>
        <StatRows rows={[
          ['Query', <a className="url" href={s.meta.query} target="_blank" rel="noreferrer">{s.meta.query}</a>, 'wrap'],
          ['Retrieved', fmtDate(s.meta.retrievedAt.slice(0, 10))],
          ['Sources', s.meta.sources.join(', '), 'wrap'],
          ['Time standard', 'LST'],
          ['Records', `${s.n.toLocaleString('en-US')} days`],
          ['Status', data.weatherOrigin === 'bundled' ? 'archived snapshot bundled with the app (works offline)' : data.weatherOrigin === 'cache' ? 'cached on this device' : 'live', 'wrap'],
        ]} />
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
      <KpiStrip>
        <Kpi label={`Rain since ${fmtDayMonth(`2001-${w.earliest}`)} ${year}`} value={curTotal != null ? `${Math.round(curTotal)} mm` : '—'} sub={medAt != null ? `median year at this date: ${Math.round(medAt)} mm` : ''} />
        {w.method === 'rain-onset' && <Kpi label={`Agronomic onset ${year}`} value={onset.date ? fmtDayMonth(onset.date) : 'not detected'} sub={`${onset.falseStarts} false start(s) · Sivakumar criterion`} />}
        <Kpi label="Root-zone wetness, 30 d" value={gw != null ? gw.toFixed(2) : '—'} sub={`normal ${Number.isFinite(gwNorm) ? gwNorm.toFixed(2) : '—'} · NASA MERRA-2 GWETROOT`} />
        <Kpi label="Latest NASA day" value={fmtDayMonth(end)} sub={`${lag} days behind today (near-real-time lag)`} />
      </KpiStrip>
      <div className="card">
        <div className="card-head"><h3>Cumulative rainfall: {year} vs {years[0]}–{years[years.length - 1]}</h3><Tag t="nasa" /></div>
        <CumulativeChart data={chart} year={year} />
        <p className="chart-cap">Cumulative rain since {fmtDayMonth(`2001-${w.earliest}`)}, mm, NASA POWER. Use this to see whether the current season is running dry or wet. It describes what has happened; it does not forecast the rest of the season. {scenario.history.some((h) => h.year === year) ? 'Your reported crop this year is reviewed in “Past-season review”.' : ''}</p>
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
      <KpiStrip>
        <Kpi label="Rain, 16 days" value={`${Math.round(rain)} mm`} />
        <Kpi label="ET₀, 16 days" value={`${Math.round(et)} mm`} sub={`water balance ${rain - et >= 0 ? '+' : ''}${Math.round(rain - et)} mm`} />
        <Kpi label="Frost / hot days" value={`${frost} / ${hot}`} sub="Tmin ≤ 0 °C / Tmax ≥ 35 °C" />
        <Kpi label="Sowing-rain signal" value={onsetLike ? fmtDayMonth(onsetLike) : 'none'} sub="3-day rain ≥ 20 mm in forecast" />
      </KpiStrip>
      <div className="card"><div className="card-head"><h3>16-day outlook</h3><div className="chips"><Tag t="forecast" /><Ref id="R26" /></div></div><ForecastChart days={d} />
        <div style={{ marginTop: 16 }} /><Callout tone="info">{inWindow ? `You are inside the ${w.label.toLowerCase()} sowing window (${fmtDayMonth(`${y}-${w.earliest}`)}–${fmtDayMonth(`${y}-${w.latest}`)}). ${onsetLike ? 'The forecast shows rain that could meet the onset criterion — confirm with a soil check (moist to ~10 cm) and watch for a dry spell afterwards.' : 'No onset-strength rain is forecast yet.'}` : `The sowing window (${fmtDayMonth(`${y}-${w.earliest}`)}–${fmtDayMonth(`${y}-${w.latest}`)}) is not open now. Use this panel for field operations; seasonal planning relies on the NASA historical replay.`}</Callout>
        <p className="chart-cap">Open-Meteo numerical forecast retrieved {fmtDate(forecast.data.retrievedAt.slice(0, 10))}. Skill drops sharply after ~7 days; this is not NASA data.</p>
      </div>
    </div>
  );
}

function SatelliteTab() {
  const { scenario: sc } = useApp();
  return (
    <div className="card">
      <div className="card-head"><h3>NASA satellite layers around your field</h3><Tag t="nasa">NASA GIBS</Tag></div>
      <p className="mini" style={{ marginBottom: 16 }}>Choose a layer and date. Compare the same date last year with “−1 year”. Colour-mapped imagery for orientation; values are not extracted at the field point.</p>
      <MapView lat={sc.location.lat} lon={sc.location.lon} tall defaultLayer="ndvi" zoom={9} />
      <div className="chips" style={{ marginTop: 8 }}><Ref id="R22" /><Ref id="R23" /><Ref id="R24" /><Ref id="R25" /></div>
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
            <div><h3><span className="mono" style={{ fontSize: 14, marginRight: 8 }}>{r.season.year}</span>{CROPS[r.season.cropId]?.emoji} {cropName(r.season.cropId)}</h3><span className="mini">{fmtDate(r.start)} → {fmtDate(r.end)}{r.datesEstimated ? ' (estimated)' : r.season.approximateDate ? ' (approximate)' : ''}{r.season.outcome ? ` · reported outcome: ${r.season.outcome}` : ''}</span></div>
            <div className="chips"><Tag t="nasa" /><Tag t="modeled" /></div>
          </div>
          <div className="cols kpi-strip" style={{ marginBottom: 16 }}>
            <Kpi label="Rain in period" value={r.rain != null ? `${Math.round(r.rain)} mm` : '—'} sub={`median ${Math.round(r.rainMedian)} mm · percentile ${Math.round(r.rainPct * 100)}`} />
            <Kpi label="Longest dry run" value={r.dryRun ? `${r.dryRun.days} d` : '—'} sub={r.dryRun ? `from ${fmtDayMonth(r.dryRun.start)}` : ''} />
            <Kpi label="Heat days" value={r.heatDays} sub={`at flowering, Tmax ≥ ${CROPS[r.season.cropId]?.heatThresholdC} °C`} />
            <Kpi label="Modeled yield" value={r.relYield != null ? `${Math.round(r.relYield * 100)}%` : '—'} sub="water-limited, of attainable (FAO-56/66)" />
          </div>
          <div className="group">
          {r.statements.map((st, i) => (
            <div key={i} className={`reason ${st.tone === 'ok' ? 'good' : st.tone}`}><span className="ico" aria-hidden>{st.tone === 'warn' ? <AlertTriangle /> : st.tone === 'ok' ? <CheckCircle2 /> : st.kind === 'limit' ? <Ruler /> : st.kind === 'fertilizer' ? <FlaskConical /> : st.kind === 'check' ? <Search /> : <Info />}</span><span>{st.text} <span className="refs">{st.refs.slice(0, 2).map((x) => <Ref key={x} id={x} />)}</span></span></div>
          ))}
          {(() => { const n = ndviStatement(peaks, r.season.year); return n ? <div className={`reason ${n.tone === 'ok' ? 'good' : n.tone}`}><span className="ico" aria-hidden><Satellite /></span><span>{n.text} <span className="refs"><Ref id="R24" /><Ref id="R35" /></span></span></div> : space.status === 'loading' ? <div className="mini" style={{ marginTop: 4 }}>Loading MODIS greenness for this season…</div> : null; })()}
          </div>
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
        <p className="chart-cap">kg per treated hectare = product kg ÷ treated ha × label %. Not plant-available nutrients, uptake or present soil status. P₂O₅ and K₂O kept in label convention (P = P₂O₅ × 0.4364; K = K₂O × 0.8301).</p></div>
      <div className="card"><div className="card-head"><h3>Records</h3></div>
        <div className="table-wrap"><table><thead><tr><th>Season</th><th className="num">Records</th><th className="num">N</th><th className="num">P₂O₅</th><th className="num">K₂O</th><th>Unknown</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td className="num">{r.count}</td><td className="num">{fmtNum(r.n, 1)}</td><td className="num">{fmtNum(r.p2o5, 1)}</td><td className="num">{fmtNum(r.k2o, 1)}</td><td className="wrap">{r.count === 0 ? 'no record (≠ none applied)' : r.unknown ? `${r.unknown} with unknown amount/area/analysis` : '—'}</td></tr>)}</tbody></table></div>
        {(() => { const c = countryInfo(sc.countryIso2); const n = c?.nutrients; return n ? <Callout tone="info">National context ({c!.name}, FAOSTAT {c!.nutrientsYear}): cropland receives on average <b>{n.nMineralKgHa ?? '—'} kg/ha mineral N</b> + {n.nManureKgHa ?? '—'} kg/ha manure N; nitrogen balance {n.nBalanceKgHa != null ? `${n.nBalanceKgHa > 0 ? '+' : ''}${n.nBalanceKgHa}` : '—'} kg/ha, use efficiency {n.nUsePct ?? '—'}%. National averages — not your field. <Ref id="R33" /></Callout> : null; })()}
        <p className="mini" style={{ marginTop: 8 }}>Soil context: {sc.soil.texture !== 'unknown' ? TEXTURE_LABEL[sc.soil.texture] : 'texture from SoilGrids'}{sc.soil.labPh ? ` · lab pH ${sc.soil.labPh}` : ''}. A soil test is the right basis for any fertilizer decision. <Ref id="R7" /></p>
      </div>
    </div>
  );
}


function CountryContext() {
  const { scenario: sc } = useApp();
  const t = useChartTheme();
  const chartH = useChartHeight(180);
  const c = countryInfo(sc.countryIso2);
  if (!c) return null;
  const series = Object.entries(c.warming?.series ?? {}).map(([y, v]) => ({ year: Number(y), v }));
  const n = c.nutrients;
  return (
    <div className="card">
      <div className="card-head"><h3>Country context · {c.name}</h3><span className="chip">FAOSTAT</span></div>
      <div className="cols kpi-strip">
        {c.warming && <Kpi label="Warming" value={`${c.warming.meanC > 0 ? '+' : ''}${c.warming.meanC.toFixed(2)} °C`} sub={`vs 1951–80, mean ${c.warming.from}–${c.warming.to}, FAOSTAT (NASA GISTEMP-based)`} />}
        {n && <Kpi label="N balance" value={n.nBalanceKgHa != null ? `${n.nBalanceKgHa > 0 ? '+' : ''}${n.nBalanceKgHa} kg/ha` : '—'} sub={`mineral N ${n.nMineralKgHa ?? '—'} · manure N ${n.nManureKgHa ?? '—'} kg/ha (${c.nutrientsYear})`} />}
        {n?.nUsePct != null && <Kpi label="N use efficiency" value={`${n.nUsePct}%`} sub="outputs ÷ inputs; >100% = soil N mining" />}
        <Kpi label="Currency" value={c.currency ?? '—'} sub={`${c.lcuPerUsd?.toLocaleString('en-US', { maximumFractionDigits: 2 })} per USD (${c.fxYear}) · ${Object.keys(c.prices).length} crop producer prices`} />
      </div>
      {series.length > 5 && (
        <div className="group">
          <div className="chart-sub">Annual temperature change vs 1951–80, °C</div>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps(t)} />
              <XAxis dataKey="year" {...xAxisProps(t)} />
              <YAxis {...axisProps(t)} width={40} allowDecimals tickCount={5} domain={[(m: number) => Math.min(0, Math.floor(m * 2) / 2), (m: number) => Math.ceil(m * 2) / 2]} />
              <Tooltip {...tipProps(t, (v) => `${Number(v).toFixed(2)} °C`)} />
              <Bar isAnimationActive={false} dataKey="v" name="Temperature change" radius={[3, 3, 0, 0]} maxBarSize={28}>{series.map((x) => <Cell key={x.year} fill={x.v > 0 ? t.c2 : t.c1} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="chart-cap">National statistics give context only; the plan itself uses NASA data for your grid cell. <Ref id="R33" /></p>
    </div>
  );
}
