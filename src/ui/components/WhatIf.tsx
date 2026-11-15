// "Stress-test against a changed climate": delta-change sliders that re-run the NASA POWER historical
// replay live for the three plans on the Compare page.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CloudRain, FlaskConical, RotateCcw, Sun, Thermometer, Timer } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { useWhatIf } from '../../state/share';
import { isIdentity, isRobust, stressHeadline, stressTest, WHATIF_PRESETS, type PlanStress, type WhatIf, type WhatIfResult } from '../../engine/whatif';
import { completeYears } from '../../weather/indicators';
import { CardTitle, pct, Tag } from './common';
import { CropPair } from './CropIcon';

const DEBOUNCE_MS = 150;
const key = (w: WhatIf) => `${w.rainScale}|${w.dT}`;
const tone = (risk: number) => (!Number.isFinite(risk) ? '' : risk < 0.15 ? 'ok' : risk < 0.35 ? 'warn' : 'bad');
/** Verdict for the what-if: robust (low and stable), weakens (rises but stays below 35%), fragile. */
const verdict = (p: PlanStress) => (isRobust(p) ? { cls: 'ok', t: 'Robust' } : Number.isFinite(p.severe[1]) && p.severe[1] < 0.35 ? { cls: 'warn', t: 'Weakens' } : { cls: 'bad', t: 'Fragile' });
const harvestTone = (x: number | null) => (x == null ? '' : x >= -0.05 ? 'ok' : x >= -0.15 ? 'warn' : 'bad');
const signed = (x: number, unit: string, d = 0) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x).toFixed(d)}${unit}`;

function Row({ p, active }: { p: PlanStress; active: boolean }) {
  const [now, then] = p.severe;
  const v = verdict(p);
  const thenTone = active ? v.cls : tone(now);
  const delta = Math.round((Number.isFinite(then) ? then : 0) * 100) - Math.round((Number.isFinite(now) ? now : 0) * 100); // matches the rounded figures shown
  return (
    <div className={`wi-row ${p.isBaseline ? 'is-base' : ''}`}>
      <div className="wi-plan">
        <span className={`wi-tag ${p.isBaseline ? 'base' : ''}`}>{p.isBaseline ? 'Your usual plan' : p.label}</span>
        <span className="wi-crops"><CropPair crops={p.crops} size={16} /></span>
      </div>
      <div className="wi-risk" aria-label={`Severe water-stress risk ${pct(now)} under the NASA record${active ? `, ${pct(then)} under the what-if` : ''}`}>
        <div className="wi-bars" aria-hidden>
          <div className="wi-bar rec"><i style={{ width: `${(Number.isFinite(now) ? now : 0) * 100}%` }} /></div>
          <div className={`wi-bar new ${thenTone}`}><i style={{ width: `${(Number.isFinite(active ? then : now) ? (active ? then : now) : 0) * 100}%` }} /></div>
        </div>
        <div className="wi-nums">
          <b className="wi-now">{pct(now)}</b>
          <ArrowRight size={14} className="wi-arrow" />
          <b className={`wi-then ${thenTone}`}>{pct(active ? then : now)}</b>
          {active && <span className={`wi-delta ${delta > 5 ? 'bad' : delta > 0 ? 'warn' : 'ok'}`}>{delta === 0 ? 'no change' : `${signed(delta, ' pts')}`}</span>}
        </div>
      </div>
      <div className={`wi-harvest ${active ? harvestTone(p.harvestChange) : ''}`}>
        <span className="t">Median harvest</span>
        <b>{active && p.harvestChange != null ? signed(Math.round(p.harvestChange * 100), '%') : '—'}</b>
      </div>
      <div className={`wi-verdict ${active ? v.cls : ''}`}>{active ? v.t : ''}</div>
    </div>
  );
}

export function WhatIfPanel() {
  const { engine, scenario, data, soil } = useApp();
  const [w, setW] = useWhatIf();
  const [applied, setApplied] = useState<WhatIf>(w);
  useEffect(() => { const t = setTimeout(() => setApplied(w), DEBOUNCE_MS); return () => clearTimeout(t); }, [w]);

  // results are cached per engine run, so revisiting a setting (or a preset) is instant
  const cache = useMemo(() => new Map<string, WhatIfResult>(), [engine, data.series, soil]);
  const run = (x: WhatIf): WhatIfResult | null => {
    if (!engine || !data.series || !soil) return null;
    const k = key(x);
    let r = cache.get(k);
    if (!r) { r = stressTest(scenario, data.series, soil, engine.pack, engine, x); cache.set(k, r); }
    return r;
  };
  const result = useMemo(() => run(applied), [cache, applied]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastMs = useRef<number | null>(null);
  if (result && !isIdentity(result.w)) lastMs.current = result.ms;

  // warm the cache with the "drier & hotter" preset while the browser is idle
  useEffect(() => {
    const preset = WHATIF_PRESETS[0].w;
    const ric = (window as any).requestIdleCallback as ((f: () => void) => number) | undefined;
    const id = ric ? ric(() => run(preset)) : window.setTimeout(() => run(preset), 600);
    return () => { const cic = (window as any).cancelIdleCallback; if (ric && cic) cic(id); else clearTimeout(id); };
  }, [cache]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!engine || !data.series || !result) return null;
  const years = completeYears(data.series);
  const span = years.length ? `${years[0]}–${years[years.length - 1]}` : '';
  const active = !isIdentity(result.w);
  const pending = key(applied) !== key(w);
  const headline = stressHeadline(result);
  const rainPct = Math.round((w.rainScale - 1) * 100);
  const headTone = !active ? 'idle' : result.plans.find((p) => p.isBaseline && !isRobust(p)) && result.plans.some((p) => !p.isBaseline && isRobust(p)) ? 'ok' : result.plans.every(isRobust) ? 'ok' : result.plans.some(isRobust) ? 'warn' : 'bad';
  const pairs = result.plans[0]?.pairs[0] ?? 0;

  return (
    <section className="card section whatif" aria-labelledby="whatif-title">
      <div className="card-head">
        <div>
          <div className="eyebrow">What-if climate</div>
          <CardTitle icon={<FlaskConical size={17} />} tone="violet"><span id="whatif-title">Stress-test against a changed climate</span></CardTitle>
        </div>
        <div className="row" style={{ gap: 6 }}><Tag t="nasa">NASA POWER {span}</Tag><Tag t="modeled" /></div>
      </div>

      <div className="wi-grid">
        <div className="wi-controls">
          <label className="wi-slider">
            <span className="wi-label"><CloudRain size={15} /> Rainfall <b className={rainPct < 0 ? 'neg' : rainPct > 0 ? 'pos' : ''}>{rainPct === 0 ? 'as recorded' : signed(rainPct, '%')}</b></span>
            <input type="range" min={-30} max={20} step={5} value={rainPct} aria-valuetext={rainPct === 0 ? 'as recorded' : `${rainPct}% rain`}
              onChange={(e) => setW({ ...w, rainScale: 1 + Number(e.target.value) / 100 })} />
            <span className="wi-ticks"><span>−30%</span><span>record</span><span>+20%</span></span>
          </label>
          <label className="wi-slider">
            <span className="wi-label"><Thermometer size={15} /> Temperature <b className={w.dT > 0 ? 'neg' : ''}>{w.dT === 0 ? 'as recorded' : `+${w.dT.toFixed(1)} °C`}</b></span>
            <input type="range" min={0} max={3} step={0.5} value={w.dT} aria-valuetext={w.dT === 0 ? 'as recorded' : `plus ${w.dT} degrees`}
              onChange={(e) => setW({ ...w, dT: Number(e.target.value) })} />
            <span className="wi-ticks"><span>+0 °C</span><span>+1.5</span><span>+3 °C</span></span>
          </label>
          <div className="wi-presets">
            {WHATIF_PRESETS.map((p) => {
              const on = key(p.w) === key(w);
              return (
                <button key={p.id} type="button" className={`btn sm ${p.id === 'reset' ? 'ghost' : ''} ${on && p.id !== 'reset' ? 'on' : ''}`} aria-pressed={on} disabled={on && p.id === 'reset'} onClick={() => setW(p.w)}>
                  {p.id === 'reset' ? <RotateCcw size={14} /> : <Sun size={14} />}{p.label}
                </button>
              );
            })}
          </div>
          <p className="wi-honest">Simple delta-change sensitivity test on the {span} NASA record, not a climate projection.</p>
          <p className="mini wi-method">Every daily rain value is scaled; ΔT is added to T2M, T2M_MAX and T2M_MIN; FAO-56 ET₀ (humidity held constant), sowing dates, the soil-water balance and the Ky yield response are then recomputed for each past season.</p>
        </div>

        <div className={`wi-results ${pending ? 'pending' : ''}`} aria-live="polite">
          <div className={`wi-headline ${headTone}`}>
            {active ? headline : <>Showing the NASA record. Move a slider or try <b>{WHATIF_PRESETS[0].label.split(':')[0]}</b> to see which plan holds up.</>}
          </div>
          <div className="wi-head-row" aria-hidden>
            <span>Plan</span><span>Severe-stress risk <i className="wi-key rec" /> record <ArrowRight size={11} /> <i className="wi-key new" /> what-if</span><span>Harvest</span><span />
          </div>
          {result.plans.map((p) => <Row key={p.id} p={p} active={active} />)}
          <div className="wi-foot mini">
            <Timer size={13} />
            {lastMs.current != null
              ? <span>Replayed {pairs} season pairs × {result.plans.length} plans on perturbed NASA POWER weather in <b>{Math.max(1, Math.round(lastMs.current))} ms</b>.</span>
              : <span>Re-runs the {pairs}-season-pair replay live for these {result.plans.length} plans.</span>}
            <span className="spacer" /><span>Severe = a season below 50% of attainable yield.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
