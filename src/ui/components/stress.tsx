// The "drier & hotter" stress test (−15% rain, +2 °C) for the plans the Compare page shows, shared by the
// landing preview, the Compare cards and the pitch slides. One replay per engine run, cached by engine identity.
import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { stressTest, WHATIF_PRESETS, type PlanStress } from '../../engine/whatif';
import type { EngineOutput, PlanResult } from '../../engine/plan';

export const DRIER_HOTTER = WHATIF_PRESETS[0].w;
export const DRIER_HOTTER_LABEL = 'Drier & hotter (−15% rain, +2 °C)';

const cache = new WeakMap<EngineOutput, Map<string, PlanStress>>();

/** Per-plan stress result under the "drier & hotter" preset (baseline + shown alternatives), or null while inputs load. */
export function useDrierHotter(): Map<string, PlanStress> | null {
  const { engine, scenario, data, soil } = useApp();
  return useMemo(() => {
    if (!engine || !data.series || !soil) return null;
    let m = cache.get(engine);
    if (!m) {
      try {
        const r = stressTest(scenario, data.series, soil, engine.pack, engine, DRIER_HOTTER);
        m = new Map(r.plans.map((p) => [p.id, p] as const));
      } catch { m = new Map(); }
      cache.set(engine, m);
    }
    return m;
  }, [engine, data.series, soil]); // eslint-disable-line react-hooks/exhaustive-deps
}

const count = (share: number, pairs: number) => (Number.isFinite(share) ? Math.round(share * pairs) : null);

/** "Severe water stress: X of 24 season pairs · drier & hotter (−15% rain, +2 °C) → Y". */
export function RiskRow({ p, s }: { p: PlanResult; s?: PlanStress | null }) {
  const pairs = p.outcome.pairs;
  const now = count(p.outcome.pSevereAny, pairs);
  const thenPairs = s?.pairs[1] ?? pairs;
  const then = s ? count(s.severe[1], thenPairs) : null;
  return (
    <div className="plan-risk" aria-label={`Severe water stress in ${now ?? 'unknown'} of ${pairs} season pairs on the NASA record${then != null ? `; ${then} if drier and hotter` : ''}`}>
      <div className="spread"><span className="caption">Severe water stress</span><b>{now ?? '—'} of {pairs} season pairs</b></div>
      <div className="plan-risk-wi">
        <span>{DRIER_HOTTER_LABEL}</span>
        <ArrowRight size={13} aria-hidden />
        <b>{then != null ? `${then} of ${thenPairs}` : '…'}</b>
      </div>
    </div>
  );
}
