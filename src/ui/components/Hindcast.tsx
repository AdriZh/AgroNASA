// Hindcast card: modeled water-limited yield index at the demo grid cell vs FAOSTAT national yield (detrended),
// both standardized (z-scores) on a shared year axis, known drought years marked.
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { allHindcasts, type HindcastResult } from '../../data/hindcast/hindcast';
import { axisProps, gridProps, legendProps, tipProps, useChartHeight, useChartTheme, xAxisProps } from './charts';
import { Ref } from './common';

function verdict(h: HindcastResult): string {
  const hit = h.hits.filter((x) => x.hit).map((x) => x.year);
  const r = h.r.toFixed(2);
  const strength = h.r >= 0.5 ? 'a moderate' : h.r >= 0.3 ? 'a weak' : 'almost no';
  return `r = ${r} over ${h.n} seasons — ${strength} year-to-year match. ${hit.length ? `Drought year${hit.length > 1 ? 's' : ''} ${hit.join(' and ')} ${hit.length > 1 ? 'fall' : 'falls'} in the model’s driest third.` : 'The known drought years are not among the model’s driest third.'}`;
}

export function HindcastChart({ h, height = 200, compact = false }: { h: HindcastResult; height?: number; compact?: boolean }) {
  const t = useChartTheme();
  const ht = useChartHeight(height);
  const data = h.points.map((p) => ({ year: p.year, model: +p.zModel.toFixed(2), national: +p.zNational.toFixed(2) }));
  const chart = (
    <ResponsiveContainer width="100%" height={ht}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="year" {...xAxisProps(t)} />
        <YAxis {...axisProps(t)} width={32} domain={compact ? [-2.5, 2.5] : [-3, 3]} ticks={[-2, 0, 2]} allowDataOverflow />
        <Tooltip {...tipProps(t, (v) => `${Number(v).toFixed(2)} σ`)} />
        {!compact && <Legend {...legendProps} />}
        {h.c.droughtYears.map((y) => <ReferenceLine key={y} x={y} stroke={t.c4} strokeDasharray="3 3" label={{ value: compact ? `${y}` : `${y} drought`, fontSize: 11, fill: t.axis, position: 'insideTopRight' }} />)}
        <ReferenceLine y={0} stroke={t.border} />
        <Line isAnimationActive={false} type="monotone" dataKey="model" name="Modeled water-limited yield (grid cell)" stroke={t.c1} strokeWidth={2} dot={{ r: 2 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="national" name={`${h.c.country} national yield, detrended (FAOSTAT)`} stroke={t.c3} strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
  if (!compact) return chart;
  // Slides: a one-line legend instead of Recharts' legend block, so the plot keeps its height.
  const key = (c: string, label: string) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: c, display: 'inline-block' }} />{label}</span>;
  return (<div><div style={{ fontSize: 13, color: t.axis, margin: '6px 0 2px' }}>{key(t.c1, 'Modeled water-limited yield (grid cell)')}{key(t.c3, `${h.c.country} national yield, detrended`)}{key(t.c4, 'drought year')}</div>{chart}</div>);
}

/** Evidence-page hindcast: all three demo crops, with an honest one-line reading each. */
export function Hindcast({ keys }: { keys?: HindcastResult['c']['key'][] }) {
  const hs = allHindcasts().filter((h) => !keys || keys.includes(h.c.key));
  return (
    <div className="card hindcast">
      <div className="card-head"><h3>Hindcast: modeled drought signal vs. real national harvests</h3><div className="chips"><Ref id="R39" /><Ref id="R8" /><Ref id="R37" /></div></div>
      <div className="grid g2">
        {hs.map((h) => (
          <div key={h.c.key}>
            <h4>{h.c.label} · r = {h.r.toFixed(2)}, n = {h.n}</h4>
            <HindcastChart h={h} />
            <p className="chart-cap">{verdict(h)}</p>
          </div>
        ))}
      </div>
      <p className="chart-cap">
        Both lines are standardized (z-scores). Model: Ya/Ym from the unchanged replay at the demo NASA POWER grid cell, rainfed, sown by the region rule.
        National: FAOSTAT QCL yield (element 5412) {hs[0]?.points[0]?.year}–{hs[0]?.points[hs[0].points.length - 1]?.year}, divided by its linear trend to remove technology gains (retrieved {hs[0]?.source.retrieved}).
        One grid cell against a whole country is a weak test: national yields also move with pests, prices, sown area and other agro-zones. It checks the direction of bad years, not field yields.
      </p>
    </div>
  );
}
