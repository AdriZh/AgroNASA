// "Why these crops here?": every crop considered at this location with its NASA screen verdict. A view of the
// engine's screen output (runEngine → screen, built by cropScreenItems in engine/plan.ts); no screening logic here.
import { Check, Sprout, X } from 'lucide-react';
import type { EngineOutput } from '../../engine/plan';
import { cropName } from '../../data/crops';
import { CropIcon } from './CropIcon';
import { Ref } from './common';

export function CropScreenPanel({ engine }: { engine: EngineOutput }) {
  const list = engine.screen?.crops ?? [];
  if (!list.length) return null;
  const multi = new Set(list.map((c) => c.seasonId)).size > 1;
  const sorted = [...list].sort((a, b) => Number(b.ok) - Number(a.ok));
  const ok = list.filter((c) => c.ok).length;
  const years = Math.max(0, ...Object.values(engine.risks).map((r) => r.years.length));
  return (
    <details className="card section disclose crop-screen">
      <summary>
        <Sprout />Why these crops here? <span className="crop-screen-count">{ok} of {list.length} pass</span>
        <span className="mini hide-sm" style={{ fontWeight: 400 }}>NASA POWER screen at this location</span>
      </summary>
      <div className="body">
        <p className="mini crop-screen-intro">
          Each crop of the {engine.pack.short} calendar is replayed in the {years} NASA POWER seasons of this grid cell: season-mean temperature against its range,
          water-limited yield (FAO-56 water balance, FAO-66 Ky) and whether it matures before the first autumn frost (Tmin ≤ 0 °C).{' '}
          {engine.screen.filtered ? 'Crops marked ✗ are removed from the candidates, so they never appear in a plan.' : 'Rotations with a crop marked ✗ are blocked and listed under Excluded rotations.'}
        </p>
        <ul className="crop-screen-list">
          {sorted.map((c) => (
            <li key={`${c.seasonId}:${c.cropId}`} className={`reason ${c.ok ? 'good' : 'block'}`}>
              <span className="ico" role="img" aria-label={c.ok ? 'passes' : 'fails'}>{c.ok ? <Check /> : <X />}</span>
              <CropIcon id={c.cropId} size={20} />
              <span className="crop-screen-text">
                <b>{cropName(c.cropId)}</b>{multi && <span className="mini"> · {c.seasonLabel}</span>} — {c.line}
                {c.refs.length > 0 && <span className="refs">{c.refs.slice(0, 3).map((x) => <Ref key={x} id={x} />)}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
