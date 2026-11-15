import { useMemo, useState } from 'react';
import { CropIcon, CropPair } from '../components/CropIcon';
import type { Route } from '../../App';
import { ArrowDown, ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { planScores, planValue, rotationBenefit, type EngineOutput, type PlanResult, type PlanScore, type ScoreKey } from '../../engine/plan';
import { cropName } from '../../data/crops';
import { fmtApprox, fmtMoney, fmtNum } from '../../domain/units';
import { fmtDayMonth } from '../../domain/dates';
import { BudgetBar, Callout, Money, NasaLoading, StatRows, StatusBadge } from '../components/common';
import { WeatherError } from '../components/NetStatus';
import { RiskRow } from '../components/stress';
import { cropOptions } from '../components/CustomPlan';
import { PrioritySliders } from '../components/PrioritySliders';
import { evaluateRotation, type EngineInputs } from '../../engine/custom';
import type { PlanStress } from '../../engine/whatif';

/** The top-ranked alternative is "Best fit" everywhere (landing, Compare, slides, what-if text). */
export const BEST_FIT = 'Best fit';
/** Caption that defends the cash-cost headline (Compare header, landing card, slide 5). */
export const CASH_CAPTION = 'Two-season cash cost before harvest, with no harvest income or credit assumed.';
const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
/** Budget in the sub-line: compact above a million so the line never wraps. */
const nb = (x: number) => (Math.abs(x) >= 1e6 ? `${(x / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M` : n0(x));

export function Seq({ crops, size }: { crops: [string, string]; size?: 'sm' }) {
  return (
    <p className={`seq ${size ?? ''}`} aria-label={`${cropName(crops[0])} then ${cropName(crops[1])}`}>
      <span className="crop"><CropIcon id={crops[0]} size={size ? 20 : 24} />{cropName(crops[0])}</span>
      <span className="arrow" aria-hidden><ArrowRight size={size ? 14 : 18} /></span>
      <span className="crop"><CropIcon id={crops[1]} size={size ? 20 : 24} />{cropName(crops[1])}</span>
    </p>
  );
}

/** Sub-line under the cash-cost hero number; color only for the budget verdict. */
export function BudgetLine({ p, cur }: { p: PlanResult; cur: string }) {
  const b = p.budget;
  const budget = b.cap;
  if (b.status === 'unverified') return <span className="sub"><span className="warn-t">Budget not verified:</span> {b.missingEssential.length} price{b.missingEssential.length === 1 ? '' : 's'} missing</span>;
  if (b.status === 'timing' && b.timingViolation) return <span className="sub"><span className="bad-t">{fmtMoney(b.timingViolation.needed - b.timingViolation.available, cur)} short</span> by {fmtDayMonth(b.timingViolation.date)}</span>;
  if (b.headroom < 0) return <span className="sub"><span className="bad-t">{fmtMoney(-b.headroom, cur)} over</span> the {nb(budget)} budget</span>;
  return <span className="sub"><span className="good-t">{fmtMoney(b.headroom, cur)} left</span> of {nb(budget)} budget</span>;
}

const severeOf = (p: PlanResult) => (Number.isFinite(p.outcome.pSevereAny) ? Math.round(p.outcome.pSevereAny * p.outcome.pairs) : null);

/**
 * One trade-off line when the other feasible option out-earns the best fit in a typical year, e.g.
 * "Option B earns ≈ 31,000 XOF more in a typical year, with more water-stress risk (1 vs 0 of 24 season pairs)."
 * Null when the best fit also has the higher (or equal) modeled net, or when either net is unknown.
 */
export function tradeOffText(alternatives: PlanResult[], cur: string): string | null {
  const [best, other] = alternatives;
  const a = best?.outcome.net?.median, b = other?.outcome.net?.median;
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  const diff = fmtApprox(b - a, cur);
  const sa = severeOf(best), sb = severeOf(other), pairs = other.outcome.pairs;
  const risk = sa == null || sb == null ? '' : sb > sa ? `, with more water-stress risk (${sb} vs ${sa} of ${pairs} season pairs)` : sb < sa ? `, with less water-stress risk (${sb} vs ${sa} of ${pairs} season pairs)` : `, with the same water-stress risk (${sb} of ${pairs} season pairs)`;
  return `${other.label || 'Option B'} earns ${diff} more in a typical year${risk}.`;
}

export function harvestText(p: PlanResult) {
  const parts = p.seasons.map((s, k) => (s.cropId === 'fallow' ? 'fallow' : `${fmtNum(p.outcome.yields[k]?.median, 1)} t`));
  return parts.join(' + ');
}

/**
 * Expected profit, shown on every plan card: average-year profit (mean NASA-replay revenue − cash cost), the bad-to-good
 * year range (20th–80th percentile of replayed season pairs) and the discounted value that the ranking uses.
 */
export function ProfitBlock({ p, cur, compact }: { p: PlanResult; cur: string; compact?: boolean }) {
  const { scenario } = useApp();
  const e = p.finance?.expectedProfit;
  if (e == null) return <div className="plan-profit muted"><span className="caption">Expected profit</span><span className="mini">needs every price and cost — set them in Budget & crops</span></div>;
  const v = planValue(p, scenario.weights).value;
  const net = p.outcome.net;
  return (
    <div className={`plan-profit ${e >= 0 ? 'pos' : 'neg'} ${compact ? 'compact' : ''}`}>
      <span className="caption">Expected profit · average year</span>
      <span className="profit-num">{e >= 0 ? '' : '−'}<Money v={Math.abs(e)} cur={cur} /></span>
      {net && <span className="sub">bad year {fmtApprox(net.p20, cur)} · good year {fmtApprox(net.p80, cur)}</span>}
      {!compact && Number.isFinite(v) && <span className="sub" title="Present value at your discount factor, after your adjustments for bad years, cash, unfamiliar crops and soil benefit. Plans are ranked by this.">Ranking value (discounted, your settings): <b>{fmtApprox(v, cur)}</b></span>}
    </div>
  );
}

const SCORE_LABEL: Record<ScoreKey, string> = {
  profit: 'Discounted profit', climate: 'Climate resilience', cost: 'Cash in hand', continuity: 'Familiar crops', soil: 'Soil sustainability',
};
const weightText = (k: ScoreKey, w: number) => (k === 'profit' ? `δ ${Math.round(w * 100)}%` : w === 0 ? 'off' : `${Math.round(w * 100)}%`);
const pts = (x: number) => (Math.abs(x) < 0.05 ? '0' : `${x > 0 ? '+' : '−'}${Math.abs(x) < 10 ? Math.abs(x).toFixed(1) : Math.round(Math.abs(x))}`);

/**
 * Expandable score: final score (best fit = 100) and, per preference, how the plan grades on it (0–100 among the
 * feasible plans), your slider weight and the points it adds. Points add up to the final score.
 */
export function ScoreDetails({ score, best }: { score: PlanScore; best?: boolean }) {
  return (
    <details className="plan-score">
      <summary>
        <span className="caption">Score</span>
        <b className="score-num">{Math.round(score.final)}</b>
        <span className="mini">{best ? 'best fit = 100' : 'vs best fit = 100'}</span>
      </summary>
      <table className="score-table">
        <colgroup><col /><col style={{ width: 64 }} /><col style={{ width: 52 }} /><col style={{ width: 48 }} /></colgroup>
        <thead><tr><th>Preference</th><th className="num" title="How this plan does on this alone, 0–100 among the feasible plans">Grade</th><th className="num" title="Your slider setting">Weight</th><th className="num" title="Points added to the score">Points</th></tr></thead>
        <tbody>
          {score.parts.map((x) => (
            <tr key={x.key}>
              <td>{SCORE_LABEL[x.key]}</td>
              <td className="num"><span className="grade-bar" aria-hidden><i style={{ width: `${x.grade}%` }} /></span>{x.grade}</td>
              <td className="num">{weightText(x.key, x.weight)}</td>
              <td className={`num ${x.points < -0.05 ? 'bad-t' : x.points > 0.05 && x.key !== 'profit' ? 'good-t' : ''}`}>{x.key !== 'profit' && x.weight === 0 ? '—' : pts(x.points)}</td>
            </tr>
          ))}
          <tr className="total"><td>Score</td><td /><td /><td className="num">{Math.round(score.final)}</td></tr>
        </tbody>
      </table>
      <p className="mini">Grades compare the plans on each preference alone. Points are that preference’s share of the plan’s discounted value, scaled so the best fit scores 100. Move the sliders to see them change.</p>
    </details>
  );
}

/** The plan card: one hero number (cash cost), budget bar, three stat rows, sowing lines. Used by Compare, Overview and Report. */
export function PlanCard({ p, cur, label, sub, tone, best, onWhy, selected, compact, risk, showNet, score }: { p: PlanResult; cur: string; label: string; sub?: string; tone?: 'brand'; best?: boolean; onWhy?: () => void; selected?: boolean; compact?: boolean; risk?: PlanStress | null; showNet?: boolean; score?: PlanScore }) {
  const severe = Math.round(p.outcome.pSevereAny * p.outcome.pairs);
  return (
    <article className={`card plan ${best ? 'best' : ''} ${compact ? 'preview' : ''}`} aria-label={`${label}: ${cropName(p.crops[0])} then ${cropName(p.crops[1])}`}>
      <div className="plan-top"><span className={`caption ${tone === 'brand' ? 'brand' : ''}`}>{label}{sub && <span className="plan-sub">{sub}</span>}</span><StatusBadge status={p.budget.status} /></div>
      <Seq crops={p.crops} />
      <div className="plan-cost">
        <div className="stat">
          <span className="caption">Cash cost</span>
          <span className="hero-num"><Money v={p.budget.totalCash} cur={cur} /></span>
        </div>
        <BudgetBar cost={p.budget.totalCash} cap={p.budget.cap} status={p.budget.status} />
        <BudgetLine p={p} cur={cur} />
        {/* inside the cost block so every card keeps the same subgrid rows (Compare, Overview, slides) */}
        <ProfitBlock p={p} cur={cur} compact={compact} />
        {score && <ScoreDetails score={score} best={best} />}
      </div>
      {compact && risk !== undefined && <RiskRow p={p} s={risk} net={showNet ? fmtApprox(p.outcome.net?.median, cur) : undefined} />}
      {!compact && <>
        <div className="group" style={{ marginTop: 0 }}>
          <StatRows rows={[
            ['Due before first sowing', fmtMoney(p.budget.upfront, cur)],
            ['Harvest, typical year', harvestText(p)],
            ['Severe stress', `${severe} of ${p.outcome.pairs} season pairs`],
          ]} />
        </div>
        <div className="plan-sow group" style={{ marginTop: 0 }}>
          {p.seasons.map((s) => (
            <div key={s.season}><span className="yr">{s.year}</span>{s.cropId === 'fallow' ? 'rest season (fallow)' : <>sow ≈ {fmtDayMonth(s.sowing)} · mature ≈ {fmtDayMonth(s.maturity)}</>}</div>
          ))}
        </div>
        {onWhy && (
          <div className="plan-foot">
            {selected ? <span className="showing">Showing details <ArrowDown size={14} /></span> : <button type="button" className="btn ghost sm" onClick={onWhy}>See why <ArrowRight /></button>}
          </div>
        )}
      </>}
    </article>
  );
}

/** One honest line that names every caveat in engine.notes; the full notes sit behind "Details". */
export function disclaimerText(engine: EngineOutput, edited: boolean) {
  const has = (c: string) => engine.notes.some((n) => n.code === c);
  const parts: string[] = [];
  if (has('BUDGET_PLACEHOLDER')) parts.push('a placeholder budget');
  parts.push(edited ? 'partly synthetic prices' : 'synthetic prices');
  if (has('PRICE_IMPLAUSIBLE')) parts.push('a corrected FAOSTAT price');
  if (engine.pack.reviewStatus !== 'reviewed') parts.push('an unreviewed rule pack');
  if (engine.notes.some((n) => n.code === 'HISTORY_INCOMPLETE' && /assumed/i.test(n.text))) parts.push('an assumed usual plan');
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Demo results: ${list}. Climate risk is a replay of past seasons, not a forecast.`;
}

/** Over / under the budget, as one short coloured line. */
function BudgetDelta({ p, cur }: { p: PlanResult; cur: string }) {
  const b = p.budget;
  if (b.status === 'unverified') return <span className="warn-t">not verified</span>;
  if (b.status === 'timing' && b.timingViolation) return <span className="bad-t">{fmtApprox(b.timingViolation.needed - b.timingViolation.available, cur)} short by {fmtDayMonth(b.timingViolation.date)}</span>;
  if (b.headroom < 0) return <span className="bad-t">{fmtApprox(-b.headroom, cur)} over</span>;
  return <span className="good-t">{fmtApprox(b.headroom, cur)} under</span>;
}

const SOIL_TAGS: Record<string, string> = { LEGUME_BENEFIT: 'legume', BREAK_CROP: 'break crop', FALLOW_BENEFIT: 'rest', ALTERNATION: 'alternation' };
/** Soil impact: rotation benefits and the fertilizer N they save the next crop, in money. */
function SoilImpact({ p, cur }: { p: PlanResult; cur: string }) {
  const tags = [...new Set(p.reasons.map((r) => SOIL_TAGS[r.code]).filter(Boolean))];
  const n = rotationBenefit(p);
  if (!n) return <span className="muted">no benefit</span>;
  const v = n * (p.finance?.nCreditValue ?? 0);
  return <span><span className="good-t">{v > 0 ? `+${fmtApprox(v, cur).replace(/^≈ /, '')}` : `+${n}`}</span><span className="pl-sub">{tags.join(' · ')}</span></span>;
}

/** Total harvest over both seasons, typical year, whole field. */
function TotalHarvest({ p }: { p: PlanResult }) {
  const ys = p.seasons.map((s, k) => (s.cropId === 'fallow' ? 0 : p.outcome.yields[k]?.median ?? NaN));
  const t = ys.reduce((a, b) => a + b, 0);
  return <span>{Number.isFinite(t) ? `${fmtNum(t, 1)} t` : '—'}<span className="pl-sub">{harvestText(p)}</span></span>;
}

/** Score with its sub-scores in a hover / focus popover. */
function ScoreHover({ score }: { score?: PlanScore }) {
  if (!score) return <span className="muted">—</span>;
  return (
    <span className="score-hover" tabIndex={0} aria-label={`Score ${Math.round(score.final)}; hover for the breakdown`}>
      <b className="score-num">{Math.round(score.final)}</b>
      <span className="score-pop" role="tooltip">
        <table className="score-table">
          <thead><tr><th>Sub-score</th><th className="num">Grade</th><th className="num">Points</th></tr></thead>
          <tbody>
            {score.parts.map((x) => (
              <tr key={x.key}>
                <td>{SCORE_LABEL[x.key]}</td>
                <td className="num"><span className="grade-bar" aria-hidden><i style={{ width: `${x.grade}%` }} /></span>{x.grade}</td>
                <td className={`num ${x.points < -0.05 ? 'bad-t' : x.points > 0.05 && x.key !== 'profit' ? 'good-t' : ''}`}>{x.key !== 'profit' && x.weight === 0 ? '—' : pts(x.points)}</td>
              </tr>
            ))}
            <tr className="total"><td>Score</td><td /><td className="num">{Math.round(score.final)}</td></tr>
          </tbody>
        </table>
        <span className="mini">Best fit = 100. Grades compare the plans on each item alone (0–100); points add up to the score.</span>
      </span>
    </span>
  );
}

function Cells({ p, cur, score }: { p: PlanResult; cur: string; score?: PlanScore }) {
  const e = p.finance?.expectedProfit;
  return <>
    <div className="pl-cell" data-h="Budget"><BudgetDelta p={p} cur={cur} /></div>
    <div className="pl-cell" data-h="Expected profit">{e == null ? <span className="muted">needs prices</span> : <b className={e < 0 ? 'bad-t' : ''}>{fmtApprox(e, cur)}</b>}</div>
    <div className="pl-cell" data-h="Soil impact"><SoilImpact p={p} cur={cur} /></div>
    <div className="pl-cell" data-h="Total harvest"><TotalHarvest p={p} /></div>
    <div className="pl-cell pl-score" data-h="Score"><ScoreHover score={score} /></div>
  </>;
}

type Own = { id: number; crops: [string, string] };

export function ComparePage({ go }: { go: (r: Route) => void }) {
  const { engine, engineError, scenario: sc, data, soil } = useApp();
  const [own, setOwn] = useState<{ pack: string; list: Own[] }>({ pack: '', list: [] });
  const inputs: EngineInputs | null = useMemo(() => (engine && data.series && soil ? { sc, series: data.series, soil, pack: engine.pack } : null), [sc, data.series, soil, engine]);
  const opts = useMemo(() => (engine ? [cropOptions(engine, 0), cropOptions(engine, 1)] as const : null), [engine]);
  const ownList = engine && own.pack === engine.pack.id ? own.list : [];
  const ownPlans = useMemo(() => ownList.map((o) => {
    if (!inputs) return null;
    try { return evaluateRotation(inputs, o.crops); } catch { return null; }
  }), [inputs, ownList]);

  const head = (
    <div className="page-head">
      <div>
        <span className="caption">Step 3 of 4</span>
        <h1>Compare plans</h1>
        {engine && <p>{engine.areaHa.toFixed(2)} ha · {engine.baseline.seasons[0].year === engine.baseline.seasons[1].year ? `${engine.baseline.seasons[0].year}` : `${engine.baseline.seasons[0].year}–${engine.baseline.seasons[1].year}`} · {fmtMoney(engine.baseline.budget.cap, sc.currency)} to spend</p>}
      </div>
      <div className="page-actions"><button className="btn" onClick={() => go('resources')}><ArrowLeft /> Budget & crops</button><button className="btn primary" onClick={() => go('evidence')}>Review evidence <ArrowRight /></button></div>
    </div>
  );
  if (engineError) return <div>{head}<Callout tone="bad">Engine error: {engineError}</Callout></div>;
  if (!engine || !opts) return <div>{head}{data.weatherStatus === 'error' ? <WeatherError /> : <NasaLoading place={sc.location.label} />}</div>;

  const plans = [engine.baseline, ...engine.alternatives];
  const extra = ownPlans.filter((p): p is PlanResult => !!p);
  // one scale for every row, the farmer's own plans included; recomputed whenever the sliders change
  const scored = [engine.baseline, ...engine.allPlans.filter((p) => p.feasible), ...extra];
  const byId = new Map(scored.map((p) => [p.id, p]));
  const scores = planScores([...byId.values()], engine.alternatives[0] ?? null, sc.weights);
  const cur = sc.currency;
  const labelOf = (p: PlanResult, i: number) => (p.isBaseline ? 'Your usual plan' : i === 1 ? BEST_FIT : p.label || 'Option B');
  const setOwnList = (f: (l: Own[]) => Own[]) => setOwn({ pack: engine.pack.id, list: f(ownList) });
  const addOwn = () => setOwnList((l) => [...l, { id: Date.now(), crops: (engine.alternatives[0] ?? engine.baseline).crops }]);
  const pick = (o: Own, slot: 0 | 1) => (
    <span className="custom-select sm">
      <CropIcon id={o.crops[slot]} size={20} />
      <select className="input sm" aria-label={`Season ${slot + 1}`} value={o.crops[slot]} onChange={(e) => setOwnList((l) => l.map((x) => (x.id === o.id ? { ...x, crops: slot === 0 ? [e.target.value, x.crops[1]] : [x.crops[0], e.target.value] } : x)))}>
        {opts[slot].map((g) => <optgroup key={g.id} label={g.label}>{g.crops.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>)}
      </select>
    </span>
  );

  return (
    <div>
      {head}

      <section className="card section" aria-label="What matters to you">
        <div className="card-head"><span className="caption">What matters to you — drag to re-rank the options</span></div>
        <PrioritySliders compact />
      </section>

      {engine.alternatives.length === 0 && (
        <div style={{ marginTop: 16 }}>
          <Callout tone="warn"><b>No feasible alternative under the stated constraints.</b> Of {engine.allPlans.length} rotations screened, none passes the rules and the budget. Raise funds or lower the reserve, allow more crops, or add your own plan below to see what blocks it.</Callout>
        </div>
      )}

      <div className="plan-list" role="table" aria-label="Plans">
        <div className="pl-row pl-head" role="row">
          <div>Rotation</div><div>Budget</div><div>Expected profit</div><div>Soil impact</div><div>Total harvest</div><div className="pl-score">Score</div>
        </div>
        {plans.map((p, i) => (
          <div key={p.id} className={`pl-row ${i === 1 ? 'best' : ''}`} role="row">
            <div className="pl-rot"><span className={`caption ${i === 1 ? 'brand' : ''}`}>{labelOf(p, i)}</span><CropPair crops={p.crops} /></div>
            <Cells p={p} cur={cur} score={scores.get(p.id)} />
          </div>
        ))}
        {ownList.map((o, k) => {
          const p = ownPlans[k];
          const same = p && plans.find((q) => q.id === p.id);
          const blocks = p && !p.feasible ? [...new Set(p.reasons.filter((r) => r.severity === 'block').map((r) => r.code.replace(/_/g, ' ').toLowerCase()))] : [];
          return (
            <div key={o.id} className="pl-row own" role="row">
              <div className="pl-rot">
                <span className="caption brand spread">Your plan {ownList.length > 1 ? k + 1 : ''}<button type="button" className="btn ghost plain icon sm" aria-label="Remove this plan" onClick={() => setOwnList((l) => l.filter((x) => x.id !== o.id))}><X /></button></span>
                <span className="own-pick">{pick(o, 0)}<ArrowRight size={14} aria-hidden />{pick(o, 1)}</span>
                {blocks.length > 0 && <span className="mini bad-t">Not an option: {blocks.join(', ')}</span>}
                {same && <span className="mini muted">Same as {same.isBaseline ? 'your usual plan' : same.label || 'a plan above'}</span>}
              </div>
              {p ? <Cells p={p} cur={cur} score={scores.get(p.id)} /> : <div className="pl-cell muted">Could not evaluate this plan.</div>}
            </div>
          );
        })}
        <div className="pl-add"><button type="button" className="btn sm" onClick={addOwn}><Plus /> Add your own plan</button></div>
      </div>
    </div>
  );
}
