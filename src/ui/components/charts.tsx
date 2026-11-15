import { useEffect, useState, type ReactNode } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { MonthClim, YearRow } from '../../weather/indicators';
import type { PlanResult } from '../../engine/plan';
import type { BudgetResult } from '../../engine/budget';
import type { ForecastDay } from '../../weather/forecast';
import { fmtDayMonth } from '../../domain/dates';
import { cropName } from '../../data/crops';

/* ==========================================================================
   Chart theming: every color is read from the CSS tokens (docs/DESIGN.md 4.10)
   and re-read when the theme changes. No color literals in chart code.
   ========================================================================== */
const TOKENS = {
  c1: '--c1', c2: '--c2', c3: '--c3', c4: '--c4', c5: '--c5', c6: '--c6', other: '--c-other',
  grid: '--chart-grid', axis: '--chart-axis', text: '--text', muted: '--text-muted', surface: '--surface', surface2: '--surface-2', border: '--border',
  brand: '--brand', accent: '--accent', good: '--good', warn: '--warn', bad: '--bad',
} as const;
export type ChartTheme = Record<keyof typeof TOKENS, string>;

function readTheme(): ChartTheme {
  const out = {} as ChartTheme;
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  for (const [k, v] of Object.entries(TOKENS)) out[k as keyof ChartTheme] = cs?.getPropertyValue(v).trim() || 'currentColor';
  return out;
}

/** Reads the design tokens and re-reads them on any theme change (toggle or OS setting). */
export function useChartTheme(): ChartTheme {
  const [t, setT] = useState<ChartTheme>(readTheme);
  useEffect(() => {
    const f = () => setT(readTheme());
    const mo = new MutationObserver(f);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', f);
    return () => { mo.disconnect(); mq?.removeEventListener?.('change', f); };
  }, []);
  return t;
}
export const useTheme = useChartTheme;

/** True at phone width (≤640 px); charts drop to 180 px there. */
export function useIsPhone(): boolean {
  const q = '(max-width: 640px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q); if (!mq) return;
    const f = () => setM(mq.matches);
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);
  return m;
}
export function useChartHeight(h: number) { return useIsPhone() ? 180 : h; }

/** Shared axis, grid and tooltip props. */
export const axisProps = (t: ChartTheme) => ({ tick: { fontSize: 12, fill: t.axis }, tickLine: false, axisLine: false, stroke: t.border });
export const xAxisProps = (t: ChartTheme) => ({ tick: { fontSize: 12, fill: t.axis }, tickLine: false, axisLine: { stroke: t.border }, interval: 'preserveStartEnd' as const, minTickGap: 24 });
export const gridProps = (t: ChartTheme) => ({ stroke: t.grid, vertical: false });
export const lastDot = (t: ChartTheme, color: string, n: number) => (p: any) => (p.index === n - 1 && p.value != null ? <circle key="last" cx={p.cx} cy={p.cy} r={4} fill={color} stroke={t.surface} strokeWidth={2} /> : <g key={p.index} />);
const kfmt = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : `${v}`);
/** Four round steps from 0 that cover max. */
export function niceTicks(max: number, n = 4) {
  const raw = Math.max(max, 1) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
  const ticks = Array.from({ length: n + 1 }, (_, i) => i * step);
  return { ticks, max: ticks[n] };
}
const n0 = (v: any) => (typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : v);

/** Tooltip: surface card, muted label, values in text color with a series swatch. */
export function ChartTip({ active, payload, label, fmt }: { active?: boolean; payload?: any[]; label?: ReactNode; fmt?: (v: any, name: string) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label != null && label !== '' && <div className="lbl">{label}</div>}
      {payload.filter((p) => p.value != null).map((p, i) => (
        <div key={i} className="r"><span><i className="sw" style={{ background: p.color ?? p.payload?.fill }} />{p.name}</span><b>{fmt ? fmt(p.value, p.name) : n0(p.value)}</b></div>
      ))}
    </div>
  );
}
export const tipProps = (t: ChartTheme, fmt?: (v: any, name: string) => ReactNode) => ({ content: <ChartTip fmt={fmt} />, cursor: { fill: t.surface2, opacity: 0.6 }, isAnimationActive: false });

/** Legend: above the plot, left-aligned, 8 px square swatches. */
export function ChartLegend({ payload }: { payload?: any[] }) {
  if (!payload?.length) return null;
  return <ul className="chart-legend">{payload.filter((p) => p.type !== 'none').map((p, i) => <li key={i}><i className="sw" style={{ background: p.color }} />{p.value}</li>)}</ul>;
}
export const legendProps = { verticalAlign: 'top' as const, align: 'left' as const, content: <ChartLegend /> };

/* ---------- charts ---------- */
/** Monthly climatology as two stacked charts sharing the x-axis (no dual axes). */
export function MonthlyClimChart({ data }: { data: MonthClim[] }) {
  const t = useChartTheme();
  const h = useChartHeight(200);
  return (
    <div>
      <div className="chart-sub">Rain and reference ET₀, mm per month</div>
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} syncId="clim">
          <CartesianGrid {...gridProps(t)} />
          <XAxis dataKey="month" {...xAxisProps(t)} interval={0} />
          <YAxis {...axisProps(t)} width={44} tickCount={5} />
          <Tooltip {...tipProps(t, (v) => `${n0(v)} mm`)} />
          <Legend {...legendProps} />
          <Bar isAnimationActive={false} dataKey="rain" name="Rain (mean monthly sum)" fill={t.c1} radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line isAnimationActive={false} dataKey="et0" name="Reference ET₀ (FAO-56)" stroke={t.c4} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="chart-sub" style={{ marginTop: 8 }}>Mean daily maximum temperature, °C</div>
      <ResponsiveContainer width="100%" height={Math.round(h * 0.6)}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} syncId="clim">
          <CartesianGrid {...gridProps(t)} />
          <XAxis dataKey="month" {...xAxisProps(t)} interval={0} />
          <YAxis {...axisProps(t)} width={44} tickCount={4} domain={['auto', 'auto']} />
          <Tooltip {...tipProps(t, (v) => `${n0(v)} °C`)} />
          <Line isAnimationActive={false} dataKey="tmax" name="Mean Tmax" stroke={t.c2} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeasonRainChart({ rows, highlight = [], height = 260 }: { rows: YearRow[]; highlight?: number[]; height?: number }) {
  const t = useChartTheme();
  const h = useChartHeight(height);
  const med = [...rows].map((r) => r.windowRain).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} margin={{ top: 8, right: 72, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="year" {...xAxisProps(t)} />
        <YAxis {...axisProps(t)} width={44} tickCount={5} />
        <Tooltip {...tipProps(t, (v) => `${Math.round(v)} mm`)} />
        <Bar isAnimationActive={false} dataKey="windowRain" name="Season rainfall" radius={[3, 3, 0, 0]} maxBarSize={28}>
          {rows.map((r) => <Cell key={r.year} fill={highlight.includes(r.year) ? t.c4 : t.c1} />)}
        </Bar>
        <ReferenceLine y={med} stroke={t.text} strokeWidth={1.5} strokeDasharray="4 3" label={{ value: `median ${Math.round(med)}`, fontSize: 12, fill: t.text, position: 'right' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DryHeatChart({ rows }: { rows: YearRow[] }) {
  const t = useChartTheme();
  const h = useChartHeight(220);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="year" {...xAxisProps(t)} />
        <YAxis {...axisProps(t)} width={40} tickCount={5} />
        <Tooltip {...tipProps(t, (v) => `${v} days`)} />
        <Legend {...legendProps} />
        <Bar isAnimationActive={false} dataKey="longestDry" name="Longest dry run (days <1 mm)" fill={t.c4} radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar isAnimationActive={false} dataKey="hotDays" name="Hot days (Tmax ≥ threshold)" fill={t.c2} radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CumulativeChart({ data, year }: { data: { day: string; p20: number; p80: number; median: number; current: number | null; band: [number, number] }[]; year: number }) {
  const t = useChartTheme();
  const h = useChartHeight(260);
  const lastIdx = data.reduce((a, d, i) => (d.current != null ? i : a), -1);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="day" {...xAxisProps(t)} />
        <YAxis {...axisProps(t)} width={44} tickCount={5} />
        <Tooltip {...tipProps(t, (v) => (Array.isArray(v) ? `${Math.round(v[0])}–${Math.round(v[1])} mm` : `${n0(v)} mm`))} />
        <Legend {...legendProps} />
        <Area isAnimationActive={false} dataKey="band" name="Typical range (20th–80th pct)" stroke="none" fill={t.c1} fillOpacity={0.15} />
        <Line isAnimationActive={false} dataKey="median" name="Median year" stroke={t.muted} strokeDasharray="4 3" dot={false} strokeWidth={1.5} />
        <Line isAnimationActive={false} dataKey="current" name={`${year} (NASA POWER near-real-time)`} stroke={t.c1} strokeWidth={2} connectNulls={false}
          dot={(p: any) => (p.index === lastIdx ? <circle key="last" cx={p.cx} cy={p.cy} r={4} fill={t.c1} stroke={t.surface} strokeWidth={2} /> : <g key={p.index} />)} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Fixed cost-category colors (DESIGN.md 4.10). */
export const CAT_TOKEN: Record<string, keyof ChartTheme> = { seed: 'c3', fertilizer: 'c1', labor: 'c4', 'land-prep': 'c2', protection: 'c5', irrigation: 'c6', other: 'other' };
export function CostChart({ plans, cap, currency }: { plans: PlanResult[]; cap: number; currency: string }) {
  const t = useChartTheme();
  const h = useChartHeight(220);
  const cats = Object.keys(CAT_TOKEN).filter((c) => plans.some((p) => p.budget.lines.some((l) => l.cash && l.category === c && (l.total ?? 0) > 0)));
  const data = plans.map((p, i) => {
    const row: any = { name: p.isBaseline ? 'Usual plan' : i === 1 ? 'Best fit' : p.label || `Option ${i}` };
    for (const c of cats) row[c] = p.budget.lines.filter((l) => l.cash && l.category === c).reduce((a, l) => a + (l.total ?? 0), 0);
    return row;
  });
  const top = niceTicks(Math.max(cap, ...data.map((r) => cats.reduce((a, c) => a + (r[c] ?? 0), 0))));
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: 4, right: 92, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="name" {...xAxisProps(t)} interval={0} />
        <YAxis {...axisProps(t)} tickFormatter={kfmt} width={44} ticks={top.ticks} domain={[0, top.max]} />
        <Tooltip {...tipProps(t, (v) => `${Math.round(v).toLocaleString('en-US')} ${currency}`)} />
        <Legend {...legendProps} />
        {cats.map((c) => <Bar isAnimationActive={false} key={c} dataKey={c} stackId="a" fill={t[CAT_TOKEN[c]]} stroke={t.surface} strokeWidth={2} name={c} maxBarSize={56} />)}
        <ReferenceLine y={cap} stroke={t.text} strokeWidth={1.5} strokeDasharray="6 3" label={{ value: `budget ${kfmt(Math.round(cap))}`, fill: t.text, fontSize: 12, position: 'right' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashTimeline({ b, currency }: { b: BudgetResult; currency: string }) {
  const t = useChartTheme();
  const h = useChartHeight(220);
  const data = b.cumulative.map((c) => ({ ...c, label: fmtDayMonth(c.date) + ' ' + c.date.slice(2, 4) }));
  return (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="label" {...xAxisProps(t)} />
        <YAxis {...axisProps(t)} tickFormatter={kfmt} width={44} tickCount={5} />
        <Tooltip {...tipProps(t, (v) => `${Math.round(v).toLocaleString('en-US')} ${currency}`)} />
        <Legend {...legendProps} />
        <Line isAnimationActive={false} type="stepAfter" dataKey="outflow" name="Cumulative cash out" stroke={t.c2} strokeWidth={2} dot={lastDot(t, t.c2, data.length)} />
        <Line isAnimationActive={false} type="stepAfter" dataKey="available" name="Cash available (funds − reserve + confirmed inflows)" stroke={t.c1} strokeWidth={2} dot={lastDot(t, t.c1, data.length)} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ReplayChart({ plan }: { plan: PlanResult }) {
  const t = useChartTheme();
  const h = useChartHeight(220);
  const [s1, s2] = plan.seasons;
  const m2 = new Map((s2.risk?.years ?? []).map((y) => [y.year, y.relYield]));
  const data = (s1.risk?.years ?? s2.risk?.years.map((y) => ({ ...y, year: y.year - 1 })) ?? []).map((y) => ({
    pair: `${y.year}→${String(y.year + 1).slice(2)}`,
    s1: s1.cropId === 'fallow' ? null : Math.round(((s1.risk?.years.find((x) => x.year === y.year)?.relYield) ?? NaN) * 100),
    s2: s2.cropId === 'fallow' ? null : (m2.has(y.year + 1) ? Math.round(m2.get(y.year + 1)! * 100) : null),
  })).filter((d) => d.s1 != null || d.s2 != null);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: 4, right: 64, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="pair" {...xAxisProps(t)} />
        <YAxis {...axisProps(t)} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={40} />
        <Tooltip {...tipProps(t, (v) => `${v}% of attainable`)} />
        <Legend {...legendProps} />
        {s1.cropId !== 'fallow' && <Bar isAnimationActive={false} dataKey="s1" name={`Season 1 ${cropName(s1.cropId)}`} fill={t.c3} radius={[3, 3, 0, 0]} maxBarSize={28} />}
        {s2.cropId !== 'fallow' && <Bar isAnimationActive={false} dataKey="s2" name={`Season 2 ${cropName(s2.cropId)}`} fill={t.c1} radius={[3, 3, 0, 0]} maxBarSize={28} />}
        <ReferenceLine y={50} stroke={t.text} strokeWidth={1.5} strokeDasharray="4 3" label={{ value: 'severe <50%', fill: t.text, fontSize: 12, position: 'right' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 16-day forecast as two stacked charts: water (mm) and temperature (°C). */
export function ForecastChart({ days }: { days: ForecastDay[] }) {
  const t = useChartTheme();
  const h = useChartHeight(200);
  const data = days.map((d) => ({ ...d, label: fmtDayMonth(d.date) }));
  return (
    <div>
      <div className="chart-sub">Rain and ET₀, mm per day</div>
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} syncId="fc">
          <CartesianGrid {...gridProps(t)} />
          <XAxis dataKey="label" {...xAxisProps(t)} />
          <YAxis {...axisProps(t)} width={44} tickCount={5} />
          <Tooltip {...tipProps(t, (v) => `${n0(v)} mm`)} />
          <Legend {...legendProps} />
          <Bar isAnimationActive={false} dataKey="rain" name="Rain" fill={t.c1} radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line isAnimationActive={false} dataKey="et0" name="ET₀" stroke={t.c4} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="chart-sub" style={{ marginTop: 8 }}>Daily temperature, °C</div>
      <ResponsiveContainer width="100%" height={Math.round(h * 0.7)}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} syncId="fc">
          <CartesianGrid {...gridProps(t)} />
          <XAxis dataKey="label" {...xAxisProps(t)} />
          <YAxis {...axisProps(t)} width={44} tickCount={4} domain={['auto', 'auto']} />
          <Tooltip {...tipProps(t, (v) => `${n0(v)} °C`)} />
          <Legend {...legendProps} />
          <Line isAnimationActive={false} dataKey="tmax" name="Tmax" stroke={t.c2} strokeWidth={2} dot={false} />
          <Line isAnimationActive={false} dataKey="tmin" name="Tmin" stroke={t.c1} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FertChart({ rows }: { rows: { label: string; n: number | null; p2o5: number | null; k2o: number | null }[] }) {
  const t = useChartTheme();
  const h = useChartHeight(220);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="label" {...xAxisProps(t)} interval={0} />
        <YAxis {...axisProps(t)} width={44} tickCount={5} />
        <Tooltip {...tipProps(t, (v) => (v == null ? 'unknown' : `${n0(v)} kg/ha`))} />
        <Legend {...legendProps} />
        <Bar isAnimationActive={false} dataKey="n" stackId="a" name="N (label)" fill={t.c3} stroke={t.surface} strokeWidth={2} maxBarSize={28} />
        <Bar isAnimationActive={false} dataKey="p2o5" stackId="a" name="P₂O₅ (label)" fill={t.c1} stroke={t.surface} strokeWidth={2} maxBarSize={28} />
        <Bar isAnimationActive={false} dataKey="k2o" stackId="a" name="K₂O (label)" fill={t.c4} stroke={t.surface} strokeWidth={2} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal P20–P80 range with median dot (0–100%). */
export function RangeBar({ p20, med, p80, width = 160 }: { p20: number; med: number; p80: number; width?: number }) {
  const t = useChartTheme();
  const x = (v: number) => 5 + Math.max(0, Math.min(1, v)) * (width - 10);
  return (
    <svg width={width} height={16} role="img" aria-label={`median ${Math.round(med * 100)}%, range ${Math.round(p20 * 100)}–${Math.round(p80 * 100)}%`} style={{ flex: '0 0 auto' }}>
      <rect x={5} y={7} width={width - 10} height={2} rx={1} fill={t.surface2} />
      <line x1={x(0.5)} x2={x(0.5)} y1={3} y2={13} stroke={t.border} />
      <rect x={x(p20)} y={4} width={Math.max(2, x(p80) - x(p20))} height={8} rx={3} fill={t.c1} opacity={0.3} />
      <circle cx={x(med)} cy={8} r={4} fill={t.c1} stroke={t.surface} strokeWidth={2} />
    </svg>
  );
}
