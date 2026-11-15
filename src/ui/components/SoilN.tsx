// Soil-N / multi-year rotation UI pieces shared by Compare (“Soil & nitrogen” tab) and the Multi-year page.
import { useMemo, useRef } from 'react';
import { CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { CropIcon } from './CropIcon';
import { Callout, Loading, Tag } from './common';
import { axisProps, gridProps, legendProps, tipProps, useChartHeight, useChartTheme, xAxisProps, type ChartTheme } from './charts';
import { cropName } from '../../data/crops';
import { fmtMoney, fmtNum } from '../../domain/units';
import { planOf, seasonsPerYear, simulateSequence, type AgriContext, type RankedPlan, type SeasonRow } from '../../engine/agrioptima/engine';
import type { ModelBundle } from '../../engine/agrioptima/model';
import { useAgri, useAgriSettings } from '../../state/useAgri';
import { MAX_RATIO, PRIOR_SEASONS } from '../../engine/agrioptima/calibration';

/** Crop icons for an option id ("wheat", "wheat+pea", "fallow"). */
export function OptionIcons({ id, size = 18 }: { id: string; size?: number }) {
  return <span className="crop-name" style={{ gap: 2 }}>{id.split('+').map((c) => <CropIcon key={c} id={c} size={size} />)}</span>;
}

export function OptionSeq({ rows }: { rows: SeasonRow[] }) {
  return (
    <p className="seq sm" aria-label={rows.map((r) => r.label).join(' then ')}>
      {rows.map((r, i) => (
        <span key={i} className="crop"><OptionIcons id={r.option} />{r.label}{i < rows.length - 1 && <span className="arrow muted" aria-hidden> → </span>}</span>
      ))}
    </p>
  );
}

const seasonName = (r: SeasonRow, double: boolean) => (double ? `${r.year} ${r.seasonLabel.split(' ')[0]}` : String(r.year));

/** Year-by-year table: the table view of every chart on these pages. */
export function SeasonTable({ rows, cur, double }: { rows: SeasonRow[]; cur: string; double: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Season</th><th>Crop</th><th className="num">Yield, t/ha</th><th className="num">Net, {cur}/ha</th>
          <th className="num">N fertilizer</th><th className="num">N fixed</th><th className="num">Soil N, kg/ha</th><th className="num">kg CO₂e/ha</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.step}>
              <td>{seasonName(r, double)}</td>
              <td><span className="crop-name"><OptionIcons id={r.option} size={16} />{r.label}</span></td>
              <td className="num">{r.family === 'fallow' ? '—' : fmtNum(r.yieldTHa, 2)}</td>
              <td className="num">{Number.isFinite(r.revenue) ? fmtMoney(r.revenue - r.costs, cur) : <span className="warn-t">no price</span>}</td>
              <td className="num">{fmtNum(r.nFert, 0)}</td>
              <td className="num">{fmtNum(r.nFixed, 0)}</td>
              <td className="num">{fmtNum(r.soilNStart, 0)} → {fmtNum(r.soilNEnd, 0)}</td>
              <td className="num">{fmtNum(r.co2e, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SERIES: (keyof ChartTheme)[] = ['c1', 'c2', 'c3'];
export const planKey = (p: RankedPlan) => p.options.join('>');

/**
 * Colour follows the rotation, not its rank: a rotation keeps its colour while it stays on screen after a slider
 * move; a newcomer takes the first free slot.
 */
export function useStableColors(keys: string[]): Map<string, keyof ChartTheme> {
  const ref = useRef(new Map<string, keyof ChartTheme>());
  return useMemo(() => {
    const prev = ref.current, next = new Map<string, keyof ChartTheme>();
    for (const k of keys) if (prev.has(k)) next.set(k, prev.get(k)!);
    for (const k of keys) {
      if (next.has(k)) continue;
      const free = SERIES.find((c) => ![...next.values()].includes(c));
      if (free) next.set(k, free);
    }
    ref.current = next;
    return next;
  }, [keys.join('|')]);
}

/** Soil mineral N at sowing of each season and after the last harvest, for up to three plans. */
export function SoilNChart({ plans, names, double, colors }: { plans: RankedPlan[]; names: string[]; double: boolean; colors: Map<string, keyof ChartTheme> }) {
  const t = useChartTheme();
  const h = useChartHeight(240);
  const shown = plans.slice(0, 3);
  const keys = shown.map(planKey);
  if (!shown.length) return null;
  const rows0 = shown[0].rows;
  const data = [...rows0.map((r, i) => ({ x: seasonName(r, double), i })), { x: 'After', i: rows0.length }].map(({ x, i }) => {
    const d: Record<string, number | string> = { x };
    shown.forEach((p, k) => { d[`p${k}`] = Math.round(i < p.rows.length ? p.rows[i].soilNStart : p.rows[p.rows.length - 1].soilNEnd); });
    return d;
  });
  const n = data.length;
  // direct end labels: push apart labels whose lines finish within ~8 % of the axis range (≈ one text line)
  const finals = shown.map((_, k) => Number(data[n - 1][`p${k}`]));
  const span = Math.max(...data.flatMap((d) => shown.map((_, k) => Number(d[`p${k}`])))) || 1;
  const order = finals.map((v, k) => ({ v, k })).sort((a, b) => b.v - a.v);
  const dy = new Array(shown.length).fill(0);
  order.forEach(({ v, k }, i) => { if (i > 0 && Math.abs(order[i - 1].v - v) < 0.08 * span) dy[k] = dy[order[i - 1].k] + 14; });
  return (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={data} margin={{ top: 4, right: 56, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="x" {...xAxisProps(t)} />
        <YAxis {...axisProps(t)} width={40} allowDecimals={false} />
        <Tooltip {...tipProps(t, (v) => `${v} kg N/ha`)} cursor={{ stroke: t.border, strokeWidth: 1 }} />
        <Legend {...legendProps} />
        {shown.map((_, k) => {
          const c = t[colors.get(keys[k]) ?? 'other'];
          return (
            <Line key={keys[k]} isAnimationActive={false} type="linear" dataKey={`p${k}`} name={names[k]} stroke={c} strokeWidth={2}
              dot={{ r: 4, fill: c, stroke: t.surface, strokeWidth: 2 }} activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2 }}>
              <LabelList dataKey={`p${k}`} content={(lp: any) => (lp.index === n - 1 ? <text x={lp.x + 8} y={lp.y + 4 + dy[k]} fontSize={12} fill={t.text}>{names[k]}</text> : null)} />
            </Line>
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Honest one-paragraph account of what the numbers are. */
export function ModelCaption({ bundle }: { bundle: ModelBundle }) {
  const y = bundle.reports.yield_model, nm = bundle.reports.nitrogen_model;
  return (
    <p className="chart-cap">
      Yield level per crop: Field Shift’s NASA POWER water-balance replay for this location. Rotation, soil-N and mixture
      effects, N uptake and N fixation: gradient-boosted models trained on {y.rows} plots from {y.experiments} INRAE
      cereal–legume field experiments (R42, R43); on sites they never saw they explain {Math.round(y.cv_grouped_by_experiment.r2 * 100)}% of
      yield and {Math.round(nm.cv_grouped_by_experiment.r2 * 100)}% of N-uptake variation. Soil-N carry-over, pre-crop and monoculture
      factors and emissions are documented priors (R44, R45). A model scenario, not a forecast or fertilizer recommendation.
    </p>
  );
}

/** Coverage notes: crops outside the trials, climate outside the training range, uncalibrated yields. */
export function CoverageNotes({ ctx }: { ctx: AgriContext }) {
  const extrap = [...new Set(ctx.options.flatMap((o) => o.extrapolated))];
  const uncal = ctx.options.filter((o) => !o.calibrated).map((o) => o.label);
  const notTrial = ctx.uncovered.filter((u) => u.reason.startsWith('not in')).map((u) => cropName(u.cropId));
  const other = ctx.uncovered.filter((u) => !u.reason.startsWith('not in'));
  const nice: Record<string, string> = { gs_mean_temp_c: 'season temperature', gs_precip_mm: 'season rainfall', gs_pet_mm: 'evaporative demand', gs_gdd: 'growing degree-days' };
  return (
    <>
      {notTrial.length > 0 && <p className="mini">Not modeled (no INRAE trial data): {notTrial.join(', ')}.</p>}
      {other.length > 0 && <p className="mini">Left out by your constraints: {other.map((u) => `${cropName(u.cropId)} (${u.reason})`).join(', ')}.</p>}
      {extrap.length > 0 && <p className="mini"><span className="warn-t">Outside the trial range:</span> {extrap.map((k) => nice[k] ?? k).join(', ')} here {extrap.length > 1 ? 'differ' : 'differs'} from the INRAE sites (mostly Europe), so rotation effects are extrapolated.</p>}
      {uncal.length > 0 && <p className="mini">No Field Shift yield level for {uncal.join(', ')}; trial-level yields are used.</p>}
    </>
  );
}

export function AgriStatus({ status, error, retry }: { status: 'loading' | 'ready' | 'error'; error?: string; retry: () => void }) {
  if (status === 'loading') return <Loading text="Loading the INRAE soil-N model…" />;
  if (status === 'error') return <Callout tone="bad">The soil-N model could not be loaded ({error}). <button type="button" className="linkish" onClick={retry}>Try again</button></Callout>;
  return null;
}

export function NotCovered({ ctx }: { ctx: AgriContext }) {
  return (
    <Callout tone="warn">
      <b>None of this region’s crops are in the INRAE trial data.</b> The soil-N model covers wheat, barley, pea, faba bean, lentil and chickpea
      (and their mixtures); {ctx.pack.short} grows {ctx.uncovered.map((u) => cropName(u.cropId)).join(', ')}. Try the Kostanay demo farm,
      or a farm in Europe, the Mediterranean, South Asia (rabi), Ethiopia, North America or Australia.
    </Callout>
  );
}

export const SoilTag = () => <span className="row" style={{ gap: 6 }}><Tag t="modeled">INRAE trials</Tag><Tag t="nasa" /></span>;

/**
 * Compare-page tab: the chosen two-season plan through the soil-N state transition, plus a one-line comparison of
 * the usual plan and the alternatives. Field Shift's own ranking is unchanged.
 */
export function CompareSoilN({ ctx, bundle, plan, others, soilN, onMultiYear }: {
  ctx: AgriContext; bundle: ModelBundle; plan: { crops: [string, string]; label: string };
  others: { crops: [string, string]; label: string }[]; soilN: number; onMultiYear: () => void;
}) {
  if (!ctx.options.some((o) => o.family !== 'fallow')) return <NotCovered ctx={ctx} />;
  const cur = ctx.currency;
  const double = seasonsPerYear(ctx) === 2;
  const run = (crops: [string, string]) => simulateSequence(ctx, crops, { soilN });
  const missing = (crops: string[]) => crops.filter((c) => !ctx.options.some((o) => o.id === c));
  const r = run(plan.crops);
  return (
    <div className="stack">
      {r ? (
        <>
          <SeasonTable rows={r.rows} cur={cur} double={double} />
          <p className="mini">
            Starting from {fmtNum(soilN, 0)} kg mineral N/ha at sowing. Fertilizer N follows a balance sheet (yield level × N need per tonne − soil N)
            and replaces the template’s urea/AN line at {fmtMoney(ctx.nPricePerKg, cur)}/kg N ({ctx.nPriceSource}).
          </p>
          <p className="mini">{calibrationSummary(ctx) ?? 'Yield level: regional NASA replay. Record past yields in Farm & history to calibrate it to your field.'}</p>
        </>
      ) : (
        <Callout tone="info">This plan includes {missing(plan.crops).map(cropName).join(' and ')}, which the INRAE trials do not cover — no soil-N estimate.</Callout>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Plan</th><th>Crops</th><th className="num">N fertilizer</th><th className="num">N fixed</th><th className="num">Soil N after</th><th className="num">kg CO₂e/ha</th></tr></thead>
          <tbody>
            {others.map((o) => {
              const s = run(o.crops);
              const p = s ? planOf(s.rows, 0, false) : null;
              return (
                <tr key={o.crops.join()}>
                  <td>{o.label}</td>
                  <td><span className="crop-name">{o.crops.map(cropName).join(' → ')}</span></td>
                  {p ? <><td className="num">{fmtNum(p.totals.nFert, 0)}</td><td className="num">{fmtNum(p.totals.nFixed, 0)}</td><td className="num">{fmtNum(p.rows[p.rows.length - 1].soilNEnd, 0)}</td><td className="num">{fmtNum(p.totals.co2e, 0)}</td></>
                    : <td colSpan={4} className="muted">not covered ({missing(o.crops).map(cropName).join(', ')})</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CoverageNotes ctx={ctx} />
      <ModelCaption bundle={bundle} />
      <div><button type="button" className="btn" onClick={onMultiYear}>Plan 3–5 years with soil N, intercrops and emissions <ArrowRight /></button></div>
    </div>
  );
}

/** Self-loading wrapper for Compare: the model chunk downloads only when this tab is opened. */
export function CompareSoilTab({ plan, others, onMultiYear }: { plan: { crops: [string, string]; label: string }; others: { crops: [string, string]; label: string }[]; onMultiYear: () => void }) {
  const { status, error, ctx, bundle, retry } = useAgri();
  const [settings] = useAgriSettings();
  if (!ctx || !bundle) return <AgriStatus status={status} error={error} retry={retry} />;
  return <CompareSoilN ctx={ctx} bundle={bundle} plan={plan} others={others} soilN={settings.soilN} onMultiYear={onMultiYear} />;
}

const pctDiff = (f: number) => (Math.abs(f - 1) < 0.005 ? 'the same as' : `${Math.round(Math.abs(f - 1) * 100)}% ${f > 1 ? 'above' : 'below'}`);

/** One line: how the farmer's recorded yields adjust the predictions. */
export function calibrationSummary(ctx: AgriContext): string | null {
  const c = ctx.yieldCal;
  if (!c.obs.length) return null;
  const crops = Object.entries(c.byCrop).map(([id, v]) => `${cropName(id)} ×${v.factor.toFixed(2)}`).join(', ');
  return `Calibrated to your ${c.obs.length} recorded season${c.obs.length > 1 ? 's' : ''}: your field has yielded ${pctDiff(c.fieldFactor)} the NASA replay for the same years (field ×${c.fieldFactor.toFixed(2)}; ${crops}).`;
}

/** Past yields → field calibration: what was compared, and the factors applied. */
export function YieldCalibrationCard({ ctx, onFarm }: { ctx: AgriContext; onFarm: () => void }) {
  const c = ctx.yieldCal;
  return (
    <section className="card section" aria-labelledby="cal-title">
      <div className="card-head"><h3 className="card-title" id="cal-title">{c.obs.length ? 'Calibrated to your past yields' : 'Your past yields'}</h3><span className="row" style={{ gap: 6 }}><Tag t="farmer" /><Tag t="nasa" /></span></div>
      {!c.obs.length ? (
        <p className="mini">
          No yields recorded yet, so predictions use the regional level. Enter what you harvested in <b>Farm &amp; history → Yield t/ha</b>: each season is
          compared with the NASA replay for that crop in that same year, so a drought year is not held against your field.{' '}
          <button type="button" className="linkish" onClick={onFarm}>Add past yields <ArrowRight size={14} /></button>
        </p>
      ) : (
        <>
          <p>{calibrationSummary(ctx)}</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Year</th><th>Crop</th><th className="num">Your yield, t/ha</th><th className="num">NASA replay, same year</th><th className="num">Ratio</th></tr></thead>
              <tbody>
                {[...c.obs].sort((a, b) => b.year - a.year).map((o, i) => (
                  <tr key={i}>
                    <td>{o.year}</td>
                    <td><span className="crop-name"><CropIcon id={o.cropId} size={16} />{cropName(o.cropId)}</span></td>
                    <td className="num">{fmtNum(o.observed, 2)}</td>
                    <td className="num">{fmtNum(o.modeled, 2)}{o.typicalYear && <span className="muted" title="This year is not yet in the complete NASA record; compared with a typical year"> · typical yr</span>}</td>
                    <td className="num">×{o.ratio.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mini">
            Ratios are pooled on a log scale and pulled toward ×1.00 as if there were {PRIOR_SEASONS} extra average seasons, so one unusual year moves the estimate only a little; single ratios are capped at ×{MAX_RATIO} and ÷{MAX_RATIO}.
            Crops without their own records use the field factor. The factor scales the yield level and, through the balance sheet, the fertilizer N need.
          </p>
        </>
      )}
      {c.skipped.length > 0 && <p className="mini">Not used: {c.skipped.map((s) => `${cropName(s.cropId)} ${s.year} (${s.reason})`).join('; ')}.</p>}
      {c.overridden.length > 0 && <p className="mini">{c.overridden.map(cropName).join(', ')}: you set this yield in Budget & crops, so it is used as is.</p>}
    </section>
  );
}
