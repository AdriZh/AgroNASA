// "Try my own plan" and "Near misses" on Compare. Both run the farmer's rotation through evaluateRotation(),
// i.e. exactly the same costing, rule checks, NASA replay and stress test as the ranked plan cards.
import { useMemo } from 'react';
import { ArrowRight, Lightbulb, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { EngineOutput, PlanResult } from '../../engine/plan';
import { blockText, evaluateRotation, nearMisses, smallestChange, stressRotation, type EngineInputs, type NearMiss } from '../../engine/custom';
import type { PlanStress } from '../../engine/whatif';
import { CROPS } from '../../data/crops';
import type { CropDef } from '../../domain/types';
import { fmtApprox, fmtMoney } from '../../domain/units';
import { BudgetBar, Money, ReasonList, Ref, StatRows, StatusBadge } from './common';
import { DRIER_HOTTER, RiskRow } from './stress';
import { BudgetLine, harvestText, Seq } from '../pages/Compare';
import { CropIcon } from './CropIcon';

const GROUPS: { id: 'cereal' | 'legume' | 'oilseed' | 'other'; label: string }[] = [
  { id: 'cereal', label: 'Cereals' }, { id: 'legume', label: 'Legumes' }, { id: 'oilseed', label: 'Oilseeds' }, { id: 'other', label: 'Other: fallow, cover crops, tubers' },
];
const groupOf = (c: CropDef) => (c.group === 'cereal' || c.group === 'legume' || c.group === 'oilseed' ? c.group : 'other');

/** Every crop in the library, grouped; crops of the local calendar first, the rest marked. */
function cropOptions(engine: EngineOutput, slot: 0 | 1) {
  const cal = new Set(engine.pack.mode === 'double' ? engine.windows[slot]?.crops ?? [] : engine.windows.flatMap((w) => w.crops));
  return GROUPS.map((g) => {
    const crops = Object.values(CROPS).filter((c) => groupOf(c) === g.id);
    const local = (c: CropDef) => c.id === 'fallow' || cal.has(c.id);
    crops.sort((a, b) => Number(b.id === 'fallow') - Number(a.id === 'fallow') || Number(local(b)) - Number(local(a)) || a.name.localeCompare(b.name));
    return { ...g, crops: crops.map((c) => ({ id: c.id, label: `${c.name}${local(c) ? '' : ' (not in local calendar)'}` })) };
  }).filter((g) => g.crops.length);
}

function useInputs(engine: EngineOutput): EngineInputs | null {
  const { scenario, data, soil } = useApp();
  return useMemo(() => (data.series && soil ? { sc: scenario, series: data.series, soil, pack: engine.pack } : null), [scenario, data.series, soil, engine.pack]);
}

const codeLabel = (code: string) => code.replace(/_/g, ' ');

export function CustomPlan({ engine, value, onChange }: { engine: EngineOutput; value: [string, string]; onChange: (v: [string, string]) => void }) {
  const inputs = useInputs(engine);
  const cur = inputs?.sc.currency ?? '';
  const res = useMemo((): { p: PlanResult; s: PlanStress | null; change: string | null } | { error: string } | null => {
    if (!inputs) return null;
    try {
      const p = evaluateRotation(inputs, value);
      let s: PlanStress | null = null;
      try { s = stressRotation(inputs, value, DRIER_HOTTER); } catch { /* stress test is optional */ }
      // the smallest input change that makes it work, only when the engine confirms it
      const change = p.feasible ? null : smallestChange(inputs, p).change;
      return { p, s, change };
    } catch (e: any) { return { error: e?.message ?? String(e) }; }
  }, [inputs, value]);
  const opts = useMemo(() => [cropOptions(engine, 0), cropOptions(engine, 1)] as const, [engine]);
  if (!res) return null;
  const p = 'p' in res ? res.p : null;
  const same = p && [engine.baseline, ...engine.alternatives].find((q) => q.id === p.id);
  const blockCodes = [...new Set((p?.reasons ?? []).filter((r) => r.severity === 'block').map((r) => r.code))];
  const pick = (slot: 0 | 1) => (
    <label className="field">
      <span>Season {slot + 1}{p ? ` · ${p.seasons[slot].year}` : ''}</span>
      <span className="custom-select">
        <CropIcon id={value[slot]} size={24} />
        <select className="input" value={value[slot]} onChange={(e) => onChange(slot === 0 ? [e.target.value, value[1]] : [value[0], e.target.value])}>
          {opts[slot].map((g) => <optgroup key={g.id} label={g.label}>{g.crops.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>)}
        </select>
      </span>
    </label>
  );
  return (
    <section className="card section custom-plan" id="custom-plan" aria-label="Try my own plan">
      <div className="card-head">
        <div>
          <span className="caption brand"><SlidersHorizontal size={14} aria-hidden /> Try my own plan</span>
          <p className="mini">Pick any two seasons. Same costs, rule checks and NASA replay as the ranked plans.</p>
        </div>
        {p && <StatusBadge status={p.budget.status} />}
      </div>
      <div className="custom-pick">
        {pick(0)}
        <span className="custom-arrow" aria-hidden><ArrowRight size={18} /></span>
        {pick(1)}
      </div>
      {'error' in res && <p className="mini bad-t">Could not evaluate this plan: {res.error}</p>}
      {p && (
        <>
          <p className="custom-verdict" aria-live="polite">
            {p.feasible
              ? <><b className="good-t">Works.</b> Passes every rule check{p.budget.status === 'unverified' ? ', but the budget is not verified' : ' and fits the budget'}.</>
              : <><b className="bad-t">Not an option.</b> Blocked by {blockCodes.map((c) => <span key={c} className="chip code">{codeLabel(c)}</span>)}</>}
            {'change' in res && res.change && <> Smallest change that makes it work: <b>{res.change}</b>.</>}
            {same && <span className="muted"> This is {same.isBaseline ? 'your usual plan' : `the ${same.label || 'ranked'} card above`}.</span>}
          </p>
          <div className="grid g2 custom-body">
            <div className="plan-cost">
              <div className="stat">
                <span className="caption">Cash cost</span>
                <span className="hero-num"><Money v={p.budget.totalCash} cur={cur} /></span>
              </div>
              <BudgetBar cost={p.budget.totalCash} cap={p.budget.cap + p.budget.inflowsTotal} status={p.budget.status} />
              <BudgetLine p={p} cur={cur} />
              <StatRows rows={[
                ['Due before first sowing', fmtMoney(p.budget.upfront, cur)],
                ['Harvest, typical year', harvestText(p)],
              ]} />
              <RiskRow p={p} s={'s' in res ? res.s : null} net={fmtApprox(p.outcome.net?.median, cur)} />
            </div>
            <div>
              <div className="caption" style={{ marginBottom: 8 }}>Reasons, with rule references</div>
              <ReasonList reasons={p.reasons} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** Compact list of the next rejected rotations, each with its block and the smallest verified change. */
export function NearMisses({ engine, onTry }: { engine: EngineOutput; onTry: (crops: [string, string]) => void }) {
  const inputs = useInputs(engine);
  const list = useMemo((): NearMiss[] => {
    if (!inputs) return [];
    try { return nearMisses(inputs, engine, 3); } catch { return []; }
  }, [inputs, engine]);
  if (!list.length) return null;
  return (
    <section className="card near-misses" aria-label="Near misses">
      <div className="card-head">
        <div>
          <span className="caption"><Lightbulb size={14} aria-hidden /> Near misses</span>
          <p className="mini">Rejected rotations and the smallest change that makes each work, checked by re-running the engine.</p>
        </div>
      </div>
      <ul className="near-list">
        {list.map((m) => (
          <li key={m.plan.id}>
            <Seq crops={m.plan.crops} size="sm" />
            <div className="near-why">
              {m.change
                ? <div className="near-fix"><span className="caption">Smallest change</span> <b>{m.change}</b></div>
                : <div className="near-fix"><span className="caption">No input change fixes it</span></div>}
              {m.blocks.map((r, k) => (
                <div key={k} className="mini">{blockText(r)}{r.refs.some((x) => !x.startsWith('input:')) && <span className="refs">{r.refs.slice(0, 2).map((x) => <Ref key={x} id={x} />)}</span>}</div>
              ))}
            </div>
            <button type="button" className="btn sm" onClick={() => onTry(m.plan.crops)} aria-label={`Try ${m.plan.crops.join(' then ')} in my own plan`}>Try it <ArrowRight /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
