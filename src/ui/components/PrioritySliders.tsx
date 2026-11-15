// Ranking preferences: the discount factor (cash now ↔ later) plus four concerns that adjust the discounted
// profit in money terms (engine/plan.ts planValue). The slider position is local while dragging and is committed to
// the scenario after a short pause, because each commit re-runs the plan engine.
import { useEffect, useRef, useState } from 'react';
import { CloudSunRain, Repeat, Sprout, Timer, Wallet } from 'lucide-react';
import type { Priority, PriorityWeights } from '../../domain/types';
import { DEFAULT_WEIGHTS, DELTA_RANGE, LIQUIDITY_PREMIUM, NEW_CROP_HAIRCUT, PRIORITY_KEYS } from '../../engine/plan';
import { useApp } from '../../state/AppContext';

export const CRITERIA: Record<Priority, { label: string; short: string; d: (v: number) => string; icon: JSX.Element }> = {
  climate: {
    label: 'Avoid bad-year losses', short: 'bad-year caution', icon: <CloudSunRain size={15} />,
    d: (v) => (v === 0 ? 'Plans are judged on an average year.' : `Revenue counts ${Math.round(v * 100)}% of the way from an average year to a bad year (20th percentile of the NASA replay).`),
  },
  cost: {
    label: 'Keep cash in hand', short: 'cash in hand', icon: <Wallet size={15} />,
    d: (v) => (v === 0 ? 'Cash you put up costs only its face value.' : `Every unit of cash you put up counts ${Math.round(v * LIQUIDITY_PREMIUM * 100)}% extra (your cost of tying up money).`),
  },
  continuity: {
    label: 'Crops I know', short: 'familiar crops', icon: <Repeat size={15} />,
    d: (v) => (v === 0 ? 'New crops are valued like ones you know.' : `Revenue from a crop you have not grown counts ${Math.round(v * NEW_CROP_HAIRCUT * 100)}% less (learning, buyers).`),
  },
  soil: {
    label: 'Soil benefit', short: 'soil', icon: <Sprout size={15} />,
    d: (v) => (v === 0 ? 'Rotation benefits are not valued in money.' : `Each legume, break-crop or rest benefit is worth ${Math.round(v * 100)}% of the fertilizer N it saves the next crop.`),
  },
};

const level = (v: number) => (v === 0 ? 'off' : v < 0.35 ? 'low' : v < 0.7 ? 'medium' : 'high');
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** One line describing the ranking, e.g. "expected profit, a year later worth 85% · bad-year caution high · …". */
export function weightsSummary(w: PriorityWeights): string {
  const delta = w.delta ?? DEFAULT_WEIGHTS.delta;
  const parts = PRIORITY_KEYS.filter((k) => (w[k] ?? 0) > 0).sort((a, b) => w[b] - w[a]).map((k) => `${CRITERIA[k].short} ${level(w[k])}`);
  return [`discounted expected profit (cash a year later worth ${pct(delta)})`, ...parts].join(' · ');
}

export function PrioritySliders({ compact }: { compact?: boolean }) {
  const { scenario: sc, update } = useApp();
  const [w, setW] = useState<PriorityWeights>({ ...DEFAULT_WEIGHTS, ...sc.weights });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // follow external changes (another page, farm switch, imported link)
  useEffect(() => { setW({ ...DEFAULT_WEIGHTS, ...sc.weights }); }, [sc.id, sc.weights]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const set = (k: keyof PriorityWeights, v: number) => {
    const next = { ...w, [k]: v };
    setW(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update((s) => ({ ...s, weights: next })), 150);
  };
  const yearsAway = (n: number) => pct(w.delta ** n);
  return (
    <div className={`prio-sliders ${compact ? 'compact' : ''}`}>
      <label className="wi-slider" title="Discount factor: how much a sale one year from now is worth to you compared with cash today.">
        <span className="wi-label"><Timer size={15} /> Cash now ↔ later <b>{pct(w.delta)}</b></span>
        <input type="range" min={DELTA_RANGE[0]} max={DELTA_RANGE[1]} step={0.01} value={w.delta} aria-valuetext={`cash one year later is worth ${pct(w.delta)} of cash today`} onChange={(e) => set('delta', Number(e.target.value))} />
        {compact ? <span className="wi-ticks"><span>now</span><span>later</span></span>
          : <span className="mini">Profit is always the goal. Cash a year away is worth {yearsAway(1)} of cash today ({yearsAway(0.5)} at 6 months), so the season that pays sooner counts more.</span>}
      </label>
      {PRIORITY_KEYS.map((k) => (
        <label key={k} className="wi-slider" title={CRITERIA[k].d(w[k])}>
          <span className="wi-label">{CRITERIA[k].icon} {CRITERIA[k].label} <b>{level(w[k])}</b></span>
          <input type="range" min={0} max={1} step={0.05} value={w[k]} aria-valuetext={`${CRITERIA[k].label}: ${level(w[k])}`} onChange={(e) => set(k, Number(e.target.value))} />
          {!compact && <span className="mini">{CRITERIA[k].d(w[k])}</span>}
        </label>
      ))}
    </div>
  );
}
