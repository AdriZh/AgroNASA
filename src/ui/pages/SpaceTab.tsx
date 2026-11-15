import { useEffect, useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, BarChart } from 'recharts';
import { AlertTriangle, CheckCircle2, Droplets, Flame, Leaf, Map as MapIcon, Satellite, Waves, Wind, CloudLightning, Mountain } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { addDays, fmtDate, fmtDayMonth } from '../../domain/dates';
import { cropName } from '../../data/crops';
import { CardTitle, Callout, Kpi, Ref, Tag, pct } from '../components/common';

const axis = { fontSize: 11, fill: '#8a94a6' };
const tip = { contentStyle: { borderRadius: 12, border: '1px solid #eaecf0', fontSize: 12 } };
const CAT_ICON: Record<string, JSX.Element> = { Wildfires: <Flame size={15} />, Floods: <Waves size={15} />, 'Severe Storms': <CloudLightning size={15} />, Drought: <AlertTriangle size={15} />, 'Dust and Haze': <Wind size={15} />, Volcanoes: <Mountain size={15} /> };

export function SpaceTab() {
  const { space, engine, scenario, data } = useApp();
  useEffect(() => { space.load(); }, [space.load]); // eslint-disable-line
  const d = space.data;

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
      <div className="loading-banner" role="status">
        <span className="ic sky" style={{ width: 44, height: 44, flexBasis: 44, borderRadius: 14 }}><Satellite size={22} /></span>
        <div style={{ flex: 1 }}>
          <b>{p ? `${p.label}: ${p.done}/${p.total} images` : 'Contacting NASA GIBS…'}</b>
          <div className="mini">Decoding NASA satellite products at your field pixel from GIBS imagery + their published colour scales. Cached on this device afterwards.</div>
          <div className="bar"><i style={p ? { width: `${(p.done / p.total) * 100}%`, animation: 'none' } : undefined} /></div>
        </div>
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
  const palette = (y: number, i: number) => (y === thisYear ? '#10b981' : i === lastYears.length - 2 ? '#3b82f6' : '#cbd5e1');
  const peaks = d.ndvi.years.filter((y) => y.peak != null);
  const r = d.ndvi.r;

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi icon={<MapIcon size={13} />} label="MODIS land cover at your pin" value={lc?.label ?? '—'} sub={isCrop ? 'MCD12Q1 IGBP 2024 · matches farmland' : 'Not mapped as cropland — check the pin location'} tone={lc ? (isCrop ? 'ok' : 'warn') : undefined} />
        <Kpi icon={<Droplets size={13} />} label="SMAP root-zone soil moisture" value={smap.now?.value != null ? `${smap.now.value.toFixed(2)} m³/m³` : '—'} sub={smap.pct != null ? `${fmtDayMonth(smap.now!.date)} · ${smap.pct <= 0.05 ? 'drier than every' : smap.pct >= 0.95 ? 'wetter than every' : `wetter than ${Math.round(smap.pct * 100)}% of`} same-date reading ${smap.normal[0]?.year}–${smap.normal.slice(-1)[0]?.year} (median ${smapMed?.toFixed(2)})` : 'no comparison yet'} tone={smap.pct != null ? (smap.pct < 0.2 ? 'warn' : smap.pct > 0.8 ? 'ok' : undefined) : undefined} />
        <Kpi icon={<Waves size={13} />} label="GRACE water storage trend" value={gTrend != null ? `${gTrend > 0 ? '+' : ''}${gTrend.toFixed(2)} cm/yr` : '—'} sub={gTrend != null ? (gTrend < -1 ? 'Declining groundwater + soil water — irrigation may not be sustainable' : gTrend > 1 ? 'Water storage rising' : 'Roughly stable') + ' · 2002–2022' : 'insufficient data'} tone={gTrend != null && gTrend < -1 ? 'bad' : undefined} />
        <Kpi icon={<AlertTriangle size={13} />} label="NASA EONET events within ~300 km" value={d.events ? d.events.length : '—'} sub={d.events ? 'last 2 years · wildfires, floods, storms, dust…' : d.eventsError ?? ''} />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><CardTitle icon={<Leaf size={17} />}>Field greenness, season by season</CardTitle><Tag t="nasa">MODIS NDVI 16-day</Tag></div>
          {ndviChart && ndviChart.rows.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ndviChart.rows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#f1f3f6" vertical={false} />
                <XAxis dataKey="label" tick={axis} interval={Math.max(0, Math.floor(ndviChart.rows.length / 7))} />
                <YAxis tick={axis} domain={[0, 1]} />
                <Tooltip {...tip} formatter={(v: any) => (v == null ? '—' : Number(v).toFixed(3))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {ndviChart.years.map((y, i) => <Line key={y} isAnimationActive={false} type="monotone" dataKey={String(y)} stroke={palette(y, i)} strokeWidth={y === thisYear || i === ndviChart.years.length - 2 ? 2.6 : 1.2} dot={false} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="mini">No valid NDVI pixels here (water, cloud or no-data).</p>}
          <p className="mini" style={{ margin: 0 }}>NDVI at your field pixel (~300 m, median of 3×3) through the {d.ndvi.seasonLabel.toLowerCase()} of each year. Green = {thisYear}, blue = last year, grey = earlier years. Observed by NASA Terra, not modeled.</p>
        </div>
        <div className="card">
          <div className="card-head"><CardTitle icon={<CheckCircle2 size={17} />} tone="violet">Independent check: model vs satellite</CardTitle><Tag t="modeled" /><Tag t="nasa" /></div>
          {d.ndvi.pairs.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={d.ndvi.pairs.map((p) => ({ ...p, relPct: Math.round(p.rel * 100) }))} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#f1f3f6" vertical={false} />
                <XAxis dataKey="year" tick={axis} />
                <YAxis yAxisId="n" tick={axis} domain={[0, 1]} />
                <YAxis yAxisId="r" orientation="right" tick={axis} unit="%" domain={[0, 100]} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="n" isAnimationActive={false} dataKey="peak" name="Season peak NDVI (MODIS)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" isAnimationActive={false} dataKey="relPct" name={`Modeled ${cropName(d.ndvi.cropId)} water-limited yield (NASA POWER + FAO-56)`} stroke="#8b5cf6" strokeWidth={2.5} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <p className="mini">Not enough overlapping seasons yet.</p>}
          <p className="mini" style={{ margin: 0 }}>
            {r != null ? <>Correlation across {d.ndvi.pairs.length} seasons: <b>r = {r.toFixed(2)}</b> — {r > 0.5 ? 'the weather-driven model and the satellite agree on good and bad years.' : r > 0.2 ? 'weak agreement; local management, irrigation or mixed pixels matter here.' : 'little agreement at this pixel — treat modeled risk with extra caution (irrigation, mixed land use or non-water limits).'}</> : 'Correlation needs at least 4 seasons.'}
            {' '}Two independent NASA products: POWER weather (model input) and MODIS vegetation (observation).
          </p>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><CardTitle icon={<Waves size={17} />} tone="sky">Total water storage anomaly (GRACE / GRACE-FO)</CardTitle><Tag t="nasa" /></div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={d.grace.series.filter((g) => g.value != null)} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#f1f3f6" vertical={false} />
              <XAxis dataKey="year" tick={axis} interval={2} />
              <YAxis tick={axis} unit=" cm" />
              <Tooltip {...tip} formatter={(v: any) => `${Number(v).toFixed(2)} cm equivalent water height`} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar isAnimationActive={false} dataKey="value" name="Water storage anomaly" radius={[3, 3, 0, 0]}>
                {d.grace.series.filter((g) => g.value != null).map((g) => <Cell key={g.year} fill={(g.value ?? 0) < 0 ? '#f59e0b' : '#3b82f6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mini" style={{ margin: 0 }}>Groundwater + soil water + surface water relative to 2004–2009 (one mid-year month per year, ~300 km mascons; 2017–18 gap between missions). A steady decline signals that irrigation draws down aquifers faster than they recharge.</p>
        </div>
        <div className="card">
          <div className="card-head"><CardTitle icon={<AlertTriangle size={17} />} tone="amber">Natural events nearby (NASA EONET)</CardTitle><Tag t="nasa" /></div>
          {d.events == null ? <p className="mini">EONET unavailable: {d.eventsError}</p> : d.events.length === 0 ? <p className="mini">No EONET events within ~300 km in the last two years.</p> : (
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Event</th><th>Date</th><th className="num">Distance</th></tr></thead>
                <tbody>{d.events.slice(0, 25).map((e) => (
                  <tr key={e.id}><td style={{ whiteSpace: 'normal' }}><span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>{CAT_ICON[e.category] ?? <AlertTriangle size={15} />}<a href={e.link} target="_blank" rel="noopener noreferrer">{e.title}</a></span></td><td>{fmtDate(e.date)}</td><td className="num">{e.km} km</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="mini" style={{ marginTop: 8 }}>Curated by NASA from GDACS, InciWeb, IRWIN and others. Context for risk, not a forecast.</p>
        </div>
      </div>

      <div className="card flat">
        <div className="mini">
          Peak NDVI by season: {peaks.map((y) => `${y.year} ${y.peak!.toFixed(2)}`).join(' · ')}. Location {scenario.location.lat.toFixed(3)}°, {scenario.location.lon.toFixed(3)}° · {engine?.pack.short} · weather {data.weatherOrigin}.
        </div>
        <div className="row" style={{ marginTop: 6 }}><Ref id="R35" /><Ref id="R24" /><Ref id="R23" /><Ref id="R36" /><Ref id="R22" /></div>
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
