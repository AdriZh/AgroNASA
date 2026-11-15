import { useEffect, useMemo } from 'react';
import { Bar, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, BarChart } from 'recharts';
import { axisProps, gridProps, legendProps, tipProps, useChartHeight, useChartTheme, xAxisProps } from '../components/charts';
import { AlertTriangle, CheckCircle2, Flame, Leaf, Loader2, Waves, Wind, CloudLightning, Mountain } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { addDays, fmtDate, fmtDayMonth } from '../../domain/dates';
import { cropName } from '../../data/crops';
import { CardTitle, Callout, Kpi, KpiStrip, Ref, Tag, pct } from '../components/common';

const CAT_ICON: Record<string, JSX.Element> = { Wildfires: <Flame size={16} />, Floods: <Waves size={16} />, 'Severe Storms': <CloudLightning size={16} />, Drought: <AlertTriangle size={16} />, 'Dust and Haze': <Wind size={16} />, Volcanoes: <Mountain size={16} /> };

export function SpaceTab() {
  const { space, engine, scenario, data } = useApp();
  useEffect(() => { space.load(); }, [space.load]); // eslint-disable-line
  const d = space.data;
  const t = useChartTheme();
  const h = useChartHeight(220);

  const ndviChart = useMemo(() => {
    if (!d) return null;
    const years = d.ndvi.years.filter((y) => y.points.some((p) => p.value != null));
    const offs = [...new Set(years.flatMap((y) => y.points.map((p) => p.doy)))].sort((a, b) => a - b);
    const start = d.ndvi.years[0]?.points[0]?.date;
    const startYear = d.ndvi.years[0]?.year;
    const rows = offs.map((o) => {
      const row: Record<string, number | string | null> = { off: o, label: start ? fmtDayMonth(addDays(`${startYear}-${start.slice(5)}`, o - (d.ndvi.years[0].points[0]?.doy ?? 0))) : String(o) };
      for (const y of years) { const p = y.points.find((x) => x.doy === o); row[String(y.year)] = p?.value ?? null; }
      return row;
    });
    return { rows, years: years.map((y) => y.year) };
  }, [d]);

  if (space.status === 'error') return <Callout tone="warn">NASA imagery could not be read ({space.error}). These panels need a network connection to NASA GIBS.</Callout>;
  if (!d) {
    const p = space.progress;
    return (
      <div role="status">
        <div className="loading-line"><Loader2 className="spin" aria-hidden />{p ? `${p.label}: ${p.done}/${p.total} images` : 'Contacting NASA GIBS…'}</div>
        <p className="mini" style={{ marginBottom: 16 }}>Decoding NASA satellite products at your field pixel from GIBS imagery and their published colour scales. Cached on this device afterwards.</p>
        <div className="grid g2"><div className="skel" style={{ height: 220 }} /><div className="skel" style={{ height: 220 }} /></div>
      </div>
    );
  }

  const lc = d.landcover;
  const isCrop = lc?.value != null && [12, 14].includes(Math.round(lc.value));
  const smap = d.smap;
  const smapNorm = smap.normal.map((x) => x.value).filter((v): v is number => v != null);
  const smapMed = smapNorm.length ? [...smapNorm].sort((a, b) => a - b)[Math.floor(smapNorm.length / 2)] : null;
  const gTrend = d.grace.trendCmYr;
  const lastYears = ndviChart?.years ?? [];
  const thisYear = lastYears[lastYears.length - 1];
  const palette = (y: number, i: number) => (y === thisYear ? t.c3 : i === lastYears.length - 2 ? t.c1 : t.other);
  const peaks = d.ndvi.years.filter((y) => y.peak != null);
  const r = d.ndvi.r;

  return (
    <div className="stack">
      <KpiStrip>
        <Kpi label="Land cover at pin" value={lc?.label ?? '—'} sub={isCrop ? 'MCD12Q1 IGBP 2024 · matches farmland' : 'Not mapped as cropland — check the pin location'} />
        <Kpi label="SMAP soil moisture" value={smap.now?.value != null ? `${smap.now.value.toFixed(2)} m³/m³` : '—'} sub={smap.pct != null ? `${fmtDayMonth(smap.now!.date)} · ${smap.pct <= 0.05 ? 'drier than every' : smap.pct >= 0.95 ? 'wetter than every' : `wetter than ${Math.round(smap.pct * 100)}% of`} same-date reading ${smap.normal[0]?.year}–${smap.normal.slice(-1)[0]?.year} (median ${smapMed?.toFixed(2)})` : 'no comparison yet'} />
        <Kpi label="GRACE storage trend" value={gTrend != null ? `${gTrend > 0 ? '+' : ''}${gTrend.toFixed(2)} cm/yr` : '—'} sub={gTrend != null ? (gTrend < -1 ? 'Declining groundwater + soil water — irrigation may not be sustainable' : gTrend > 1 ? 'Water storage rising' : 'Roughly stable') + ' · 2002–2022' : 'insufficient data'} />
        <Kpi label="EONET events nearby" value={d.events ? d.events.length : '—'} sub={d.events ? 'within ~300 km, last 2 years: fires, floods, storms, dust' : d.eventsError ?? ''} />
      </KpiStrip>

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><CardTitle icon={<Leaf />}>Field greenness by season</CardTitle><Tag t="nasa">MODIS NDVI 16-day</Tag></div>
          {ndviChart && ndviChart.rows.length ? (
            <ResponsiveContainer width="100%" height={h}>
              <LineChart data={ndviChart.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps(t)} />
                <XAxis dataKey="label" {...xAxisProps(t)} />
                <YAxis {...axisProps(t)} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} width={40} />
                <Tooltip {...tipProps(t, (v) => (v == null ? '—' : Number(v).toFixed(3)))} />
                <Legend {...legendProps} payload={[{ value: String(thisYear), type: 'square', color: t.c3 }, ...(lastYears.length > 1 ? [{ value: String(lastYears[lastYears.length - 2]), type: 'square' as const, color: t.c1 }] : []), { value: 'earlier years', type: 'square', color: t.other }]} />
                {ndviChart.years.map((y, i) => <Line key={y} isAnimationActive={false} type="monotone" dataKey={String(y)} stroke={palette(y, i)} strokeWidth={y === thisYear || i === ndviChart.years.length - 2 ? 2 : 1} dot={false} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="mini">No valid NDVI pixels here (water, cloud or no-data).</p>}
          <p className="chart-cap">NDVI at your field pixel (~300 m, median of 3×3) through the {d.ndvi.seasonLabel.toLowerCase()} of each year. Observed by NASA Terra, not modeled.</p>
        </div>
        <div className="card">
          <div className="card-head"><CardTitle icon={<CheckCircle2 />}>Independent check: model vs satellite</CardTitle><Tag t="nasa" /></div>
          {d.ndvi.pairs.length ? (
            <div>
              <div className="chart-sub">Season peak NDVI, observed by MODIS</div>
              <ResponsiveContainer width="100%" height={Math.round(h * 0.6)}>
                <BarChart data={d.ndvi.pairs} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} syncId="chk">
                  <CartesianGrid {...gridProps(t)} />
                  <XAxis dataKey="year" {...xAxisProps(t)} />
                  <YAxis {...axisProps(t)} domain={[0, 1]} ticks={[0, 0.5, 1]} width={40} />
                  <Tooltip {...tipProps(t, (v) => Number(v).toFixed(2))} />
                  <Bar isAnimationActive={false} dataKey="peak" name="Peak NDVI" fill={t.c3} radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
              <div className="chart-sub" style={{ marginTop: 8 }}>Modeled {cropName(d.ndvi.cropId)} water-limited yield, % of attainable</div>
              <ResponsiveContainer width="100%" height={Math.round(h * 0.6)}>
                <LineChart data={d.ndvi.pairs.map((p) => ({ ...p, relPct: Math.round(p.rel * 100) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} syncId="chk">
                  <CartesianGrid {...gridProps(t)} />
                  <XAxis dataKey="year" {...xAxisProps(t)} />
                  <YAxis {...axisProps(t)} domain={[0, 100]} ticks={[0, 50, 100]} width={40} />
                  <Tooltip {...tipProps(t, (v) => `${v}%`)} />
                  <Line isAnimationActive={false} dataKey="relPct" name="Modeled yield" stroke={t.c1} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="mini">Not enough overlapping seasons yet.</p>}
          <p className="chart-cap">
            {r != null ? <>Correlation across {d.ndvi.pairs.length} seasons: <b>r = {r.toFixed(2)}</b> — {r > 0.5 ? 'the weather-driven model and the satellite agree on good and bad years.' : r > 0.2 ? 'weak agreement; local management, irrigation or mixed pixels matter here.' : 'little agreement at this pixel — treat modeled risk with extra caution (irrigation, mixed land use or non-water limits).'}</> : 'Correlation needs at least 4 seasons.'}
            {' '}Two independent NASA products: POWER weather (model input) and MODIS vegetation (observation).
          </p>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><CardTitle icon={<Waves />}>Water storage anomaly (GRACE)</CardTitle><Tag t="nasa" /></div>
          <ResponsiveContainer width="100%" height={h}>
            <BarChart data={d.grace.series.filter((g) => g.value != null)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps(t)} />
              <XAxis dataKey="year" {...xAxisProps(t)} />
              <YAxis {...axisProps(t)} width={40} tickCount={5} />
              <Tooltip {...tipProps(t, (v) => `${Number(v).toFixed(2)} cm`)} />
              <ReferenceLine y={0} stroke={t.border} />
              <Bar isAnimationActive={false} dataKey="value" name="Storage anomaly" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {d.grace.series.filter((g) => g.value != null).map((g) => <Cell key={g.year} fill={(g.value ?? 0) < 0 ? t.c4 : t.c1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="chart-cap">Equivalent water height, cm, GRACE / GRACE-FO. Groundwater + soil water + surface water relative to 2004–2009 (one mid-year month per year, ~300 km mascons; 2017–18 gap between missions). A steady decline signals that irrigation draws down aquifers faster than they recharge.</p>
        </div>
        <div className="card">
          <div className="card-head"><CardTitle icon={<AlertTriangle />}>Natural events nearby (EONET)</CardTitle><Tag t="nasa" /></div>
          {d.events == null ? <p className="mini">EONET unavailable: {d.eventsError}</p> : d.events.length === 0 ? <p className="mini">No EONET events within ~300 km in the last two years.</p> : (
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Event</th><th>Date</th><th className="num">Distance</th></tr></thead>
                <tbody>{d.events.slice(0, 25).map((e) => (
                  <tr key={e.id}><td className="wrap"><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>{CAT_ICON[e.category] ?? <AlertTriangle size={16} />}<a href={e.link} target="_blank" rel="noopener noreferrer">{e.title}</a></span></td><td>{fmtDate(e.date)}</td><td className="num">{e.km} km</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="chart-cap">Curated by NASA from GDACS, InciWeb, IRWIN and others. Context for risk, not a forecast.</p>
        </div>
      </div>

      <div className="card">
        <div className="mini">
          Peak NDVI by season: {peaks.map((y) => `${y.year} ${y.peak!.toFixed(2)}`).join(' · ')}. Location {scenario.location.lat.toFixed(3)}°, {scenario.location.lon.toFixed(3)}° · {engine?.pack.short} · weather {data.weatherOrigin}.
        </div>
        <div className="chips" style={{ marginTop: 8 }}><Ref id="R35" /><Ref id="R24" /><Ref id="R23" /><Ref id="R36" /><Ref id="R22" /></div>
      </div>
    </div>
  );
}

/** NDVI-based statement for the past-season review (observed greenness vs this field's own normal). */
export function ndviStatement(peaks: { year: number; peak: number | null }[], year: number): { text: string; tone: 'warn' | 'ok' | 'info' } | null {
  const y = peaks.find((p) => p.year === year);
  const others = peaks.filter((p) => p.year !== year && p.peak != null).map((p) => p.peak!) ;
  if (!y || y.peak == null || others.length < 3) return null;
  const sorted = [...others].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const below = others.filter((v) => v < y.peak!).length / others.length;
  const tone = below <= 0.2 ? 'warn' : below >= 0.8 ? 'ok' : 'info';
  return { tone, text: `MODIS satellite greenness at this field peaked at NDVI ${y.peak.toFixed(2)} (field’s typical peak ${med.toFixed(2)}) — ${below <= 0.2 ? 'among the weakest seasons observed, consistent with crop stress' : below >= 0.8 ? 'among the strongest seasons observed' : 'within the usual range'} (${pct(below)} of other seasons were lower). Observed, ~300 m pixel.` };
}
