import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts';
import type { MonthClim, YearRow } from '../../weather/indicators';
import type { PlanResult } from '../../engine/plan';
import type { BudgetResult } from '../../engine/budget';
import type { ForecastDay } from '../../weather/forecast';
import { fmtDayMonth } from '../../domain/dates';
import { cropName } from '../../data/crops';

const C = { rain: '#3b82f6', et0: '#f59e0b', tmax: '#ef4444', tmin: '#60a5fa', green: '#10b981', grey: '#94a3b8', violet: '#8b5cf6', band: '#dbeafe' };
const axis = { fontSize: 11, fill: '#8a94a6' };
const tip = { contentStyle: { borderRadius: 12, border: '1px solid #eaecf0', fontSize: 12, boxShadow: '0 12px 32px -8px rgba(16,24,40,.18)' }, cursor: { fill: 'rgba(16,24,40,.04)' } };
const n0 = (v: any) => (typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : v);

export function MonthlyClimChart({ data }: { data: MonthClim[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="month" tick={axis} />
        <YAxis yAxisId="mm" tick={axis} unit=" mm" width={60} />
        <YAxis yAxisId="t" orientation="right" tick={axis} unit="°" width={36} />
        <Tooltip {...tip} formatter={n0} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} yAxisId="mm" dataKey="rain" name="Rain (mean monthly sum)" fill={C.rain} radius={[4, 4, 0, 0]} />
        <Line isAnimationActive={false} yAxisId="mm" dataKey="et0" name="Reference ET₀ (FAO-56)" stroke={C.et0} strokeWidth={2} dot={false} />
        <Line isAnimationActive={false} yAxisId="t" dataKey="tmax" name="Mean Tmax °C" stroke={C.tmax} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SeasonRainChart({ rows, highlight = [] }: { rows: YearRow[]; highlight?: number[] }) {
  const med = [...rows].map((r) => r.windowRain).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="year" tick={axis} interval={1} />
        <YAxis tick={axis} unit=" mm" width={60} />
        <Tooltip {...tip} formatter={n0} />
        <ReferenceLine y={med} stroke="#334155" strokeDasharray="4 3" label={{ value: `median ${Math.round(med)} mm`, fontSize: 11, fill: '#334155', position: 'insideTopRight' }} />
        <Bar isAnimationActive={false} dataKey="windowRain" name="Season rainfall" radius={[3, 3, 0, 0]}>
          {rows.map((r) => <Cell key={r.year} fill={highlight.includes(r.year) ? '#f59e0b' : C.rain} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DryHeatChart({ rows }: { rows: YearRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="year" tick={axis} interval={2} />
        <YAxis tick={axis} />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="longestDry" name="Longest dry run (days <1 mm)" fill="#fbbf24" radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="hotDays" name="Hot days (Tmax ≥ threshold)" fill={C.tmax} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CumulativeChart({ data, year }: { data: { day: string; p20: number; p80: number; median: number; current: number | null; band: [number, number] }[]; year: number }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="day" tick={axis} interval={Math.max(1, Math.floor(data.length / 8))} />
        <YAxis tick={axis} unit=" mm" width={60} />
        <Tooltip {...tip} formatter={(v: any) => (Array.isArray(v) ? `${Math.round(v[0])}–${Math.round(v[1])}` : n0(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area isAnimationActive={false} dataKey="band" name="Typical range (20th–80th pct)" stroke="none" fill={C.band} fillOpacity={0.6} />
        <Line isAnimationActive={false} dataKey="median" name="Median year" stroke="#334155" strokeDasharray="4 3" dot={false} strokeWidth={1.5} />
        <Line isAnimationActive={false} dataKey="current" name={`${year} (NASA POWER near-real-time)`} stroke="#f59e0b" dot={false} strokeWidth={2.5} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const CAT_COLORS: Record<string, string> = { seed: '#10b981', fertilizer: '#8b5cf6', labor: '#f59e0b', 'land-prep': '#a16207', protection: '#ef4444', irrigation: '#3b82f6', other: '#cbd5e1' };
export function CostChart({ plans, cap, currency }: { plans: PlanResult[]; cap: number; currency: string }) {
  const cats = Object.keys(CAT_COLORS);
  const data = plans.map((p) => {
    const row: any = { name: p.isBaseline ? 'Usual plan' : p.label };
    for (const c of cats) row[c] = p.budget.lines.filter((l) => l.cash && l.category === c).reduce((a, l) => a + (l.total ?? 0), 0);
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 16, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="name" tick={axis} />
        <YAxis tick={axis} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : v)} width={50} />
        <Tooltip {...tip} formatter={(v: any) => `${Math.round(v).toLocaleString('en-US')} ${currency}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {cats.map((c) => <Bar isAnimationActive={false} key={c} dataKey={c} stackId="a" fill={CAT_COLORS[c]} name={c} />)}
        <ReferenceLine y={cap} stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" label={{ value: `spendable ${Math.round(cap).toLocaleString('en-US')}`, fill: '#ef4444', fontSize: 11, position: 'insideTopLeft' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashTimeline({ b, currency }: { b: BudgetResult; currency: string }) {
  const data = b.cumulative.map((c) => ({ ...c, label: fmtDayMonth(c.date) + ' ' + c.date.slice(2, 4) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
        <YAxis tick={axis} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : v)} width={50} />
        <Tooltip {...tip} formatter={(v: any) => `${Math.round(v).toLocaleString('en-US')} ${currency}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line isAnimationActive={false} type="stepAfter" dataKey="outflow" name="Cumulative cash out" stroke="#f59e0b" strokeWidth={2} dot />
        <Line isAnimationActive={false} type="stepAfter" dataKey="available" name="Cash available (funds − reserve + confirmed inflows)" stroke={C.green} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ReplayChart({ plan }: { plan: PlanResult }) {
  const [s1, s2] = plan.seasons;
  const m2 = new Map((s2.risk?.years ?? []).map((y) => [y.year, y.relYield]));
  const data = (s1.risk?.years ?? s2.risk?.years.map((y) => ({ ...y, year: y.year - 1 })) ?? []).map((y) => ({
    pair: `${y.year}→${String(y.year + 1).slice(2)}`,
    s1: s1.cropId === 'fallow' ? null : Math.round(((s1.risk?.years.find((x) => x.year === y.year)?.relYield) ?? NaN) * 100),
    s2: s2.cropId === 'fallow' ? null : (m2.has(y.year + 1) ? Math.round(m2.get(y.year + 1)! * 100) : null),
  })).filter((d) => d.s1 != null || d.s2 != null);
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="pair" tick={{ ...axis, fontSize: 9 }} interval={2} />
        <YAxis tick={axis} unit="%" domain={[0, 100]} />
        <Tooltip {...tip} formatter={(v: any) => `${v}% of attainable`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="4 3" />
        {s1.cropId !== 'fallow' && <Bar isAnimationActive={false} dataKey="s1" name={`S1 ${cropName(s1.cropId)}`} fill={C.green} />}
        {s2.cropId !== 'fallow' && <Bar isAnimationActive={false} dataKey="s2" name={`S2 ${cropName(s2.cropId)}`} fill={C.violet} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ForecastChart({ days }: { days: ForecastDay[] }) {
  const data = days.map((d) => ({ ...d, label: fmtDayMonth(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="label" tick={axis} interval={1} />
        <YAxis yAxisId="mm" tick={axis} unit=" mm" width={56} />
        <YAxis yAxisId="t" orientation="right" tick={axis} unit="°" width={34} />
        <Tooltip {...tip} formatter={n0} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} yAxisId="mm" dataKey="rain" name="Rain mm" fill={C.rain} radius={[3, 3, 0, 0]} />
        <Line isAnimationActive={false} yAxisId="mm" dataKey="et0" name="ET₀ mm" stroke={C.et0} dot={false} />
        <Line isAnimationActive={false} yAxisId="t" dataKey="tmax" name="Tmax" stroke={C.tmax} dot={false} />
        <Line isAnimationActive={false} yAxisId="t" dataKey="tmin" name="Tmin" stroke={C.tmin} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function FertChart({ rows }: { rows: { label: string; n: number | null; p2o5: number | null; k2o: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#f1f3f6" vertical={false} />
        <XAxis dataKey="label" tick={axis} />
        <YAxis tick={axis} unit=" kg/ha" width={70} />
        <Tooltip {...tip} formatter={(v: any) => (v == null ? 'unknown' : `${n0(v)} kg/ha`)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="n" stackId="a" name="N (label)" fill="#10b981" />
        <Bar isAnimationActive={false} dataKey="p2o5" stackId="a" name="P₂O₅ (label)" fill="#8b5cf6" />
        <Bar isAnimationActive={false} dataKey="k2o" stackId="a" name="K₂O (label)" fill="#f59e0b" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal P20–P80 range with median dot (0–100%). */
export function RangeBar({ p20, med, p80, width = 160 }: { p20: number; med: number; p80: number; width?: number }) {
  const x = (v: number) => Math.max(0, Math.min(1, v)) * width;
  const col = med >= 0.75 ? '#10b981' : med >= 0.5 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={width} height={16} role="img" aria-label={`median ${Math.round(med * 100)}%, range ${Math.round(p20 * 100)}–${Math.round(p80 * 100)}%`}>
      <rect x={0} y={7} width={width} height={2} fill="#e2e8f0" />
      <line x1={x(0.5)} x2={x(0.5)} y1={3} y2={13} stroke="#cbd5e1" />
      <rect x={x(p20)} y={4} width={Math.max(2, x(p80) - x(p20))} height={8} rx={4} fill={col} opacity={0.3} />
      <circle cx={x(med)} cy={8} r={5} fill={col} />
    </svg>
  );
}
