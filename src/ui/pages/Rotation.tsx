// Multi-year rotation planner: Field Shift's farm, NASA climate, prices and rotation rules, extended over 2–5 years
// with the INRAE soil-N state transition, cereal–legume mixtures and a three-slider trade-off (AgriOptima engine).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Coins, Leaf, Sprout, Timer } from 'lucide-react';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import { LIMITS, useAgri, useAgriSettings } from '../../state/useAgri';
import { rank, seasonsPerYear, simulateAll, simulateSequence, planOf, utilityOf, type RankedPlan } from '../../engine/agrioptima/engine';
import { fmtApprox, fmtMoney, fmtNum } from '../../domain/units';
import { DELTA_RANGE } from '../../engine/plan';
import { CardTitle, Callout, NasaLoading, NumInput, Seg } from '../components/common';
import { WeatherError } from '../components/NetStatus';
import { useChartTheme } from '../components/charts';
import { AgriStatus, CoverageNotes, ModelCaption, NotCovered, OptionSeq, planKey, SeasonTable, SoilNChart, SoilTag, useStableColors, YieldCalibrationCard } from '../components/SoilN';

const signed = (x: number, d = 0) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${fmtNum(Math.abs(x), d)}`;

export function RotationPage({ go }: { go: (r: Route) => void }) {
  const { engine, data, scenario: sc, update } = useApp();
  const { status, error, ctx, bundle, retry } = useAgri();
  const [s, set] = useAgriSettings();
  // discount factor = the farm's own, shared with Compare; local while dragging, committed after a pause
  const [delta, setDelta] = useState(sc.weights.delta);
  useEffect(() => setDelta(sc.weights.delta), [sc.id, sc.weights.delta]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const changeDelta = (v: number) => { setDelta(v); clearTimeout(timer.current); timer.current = setTimeout(() => update((x) => ({ ...x, weights: { ...x.weights, delta: v } })), 150); };
  const weights = useMemo(() => ({ ...s, delta }), [s, delta]);
  const t = useChartTheme();

  const double = !!ctx && seasonsPerYear(ctx) === 2;
  const seasons = s.years * (double ? 2 : 1);
  const sim = useMemo(() => (ctx && ctx.options.some((o) => o.family !== 'fallow') ? simulateAll(ctx, seasons, { soilN: s.soilN, intercrops: s.intercrops }) : null), [ctx, seasons, s.soilN, s.intercrops]);
  const ranked = useMemo(() => (sim ? rank(sim, weights, 5) : null), [sim, weights]);
  const usual = useMemo(() => {
    if (!ctx || !engine) return null;
    const base = engine.baseline.crops;
    const r = simulateSequence(ctx, Array.from({ length: seasons }, (_, i) => base[i % 2]), { soilN: s.soilN });
    return r ? { ...r, plan: planOf(r.rows, utilityOf(ctx, r.rows, double ? 2 : 1, weights), false) } : null;
  }, [ctx, engine, seasons, s.soilN, weights, double]);
  const plans = ranked?.plans ?? [];
  const colors = useStableColors(plans.slice(0, 3).map(planKey));

  const head = (
    <div className="page-head">
      <div>
        <span className="caption">Beyond two seasons</span>
        <h1>Multi-year rotation & soil nitrogen</h1>
        <p>Every rotation Field Shift’s rules allow over {s.years} years, simulated season by season: what each crop leaves in the soil changes the next crop’s yield and fertilizer need. Move the sliders to weigh cash now against soil health and emissions.</p>
      </div>
      <div className="page-actions"><button className="btn" onClick={() => go('compare')}><ArrowLeft /> Two-season plans</button></div>
    </div>
  );
  if (!engine) return <div>{head}{data.weatherStatus === 'error' ? <WeatherError /> : <NasaLoading place={sc.location.label} />}</div>;
  if (!ctx || !bundle) return <div>{head}<AgriStatus status={status} error={error} retry={retry} /></div>;
  if (!ctx.options.some((o) => o.family !== 'fallow')) return <div>{head}<NotCovered ctx={ctx} /></div>;

  const cur = ctx.currency;
  const best = plans[0];
  const swatch = (p: RankedPlan) => { const k = colors.get(planKey(p)); return k ? <i className="sw" style={{ background: t[k], display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 6 }} aria-hidden /> : null; };
  const vsUsual = best && usual ? best.totals.net - usual.plan.totals.net : null;

  return (
    <div>
      {head}
      <section className="card section" aria-labelledby="rot-controls">
        <div className="card-head"><CardTitle icon={<Sprout />}><span id="rot-controls">Your priorities</span></CardTitle><SoilTag /></div>
        <div className="wi-grid">
          <div className="wi-controls">
            <label className="wi-slider">
              <span className="wi-label"><Timer size={15} /> Cash now ↔ later <b>{Math.round(delta * 100)}%</b></span>
              <input type="range" min={DELTA_RANGE[0]} max={DELTA_RANGE[1]} step={0.01} value={delta} aria-valuetext={`each later year counts ${Math.round(delta * 100)}% of the one before`} onChange={(e) => changeDelta(Number(e.target.value))} />
              <span className="wi-ticks"><span>this year</span><span>each year counts {Math.round(delta * 100)}% · same as Compare</span><span>all years</span></span>
            </label>
            <label className="wi-slider">
              <span className="wi-label"><Leaf size={15} /> Soil health <b>{s.wSoilUsd === 0 ? 'not valued' : `${fmtNum(s.wSoilUsd, 1)} USD/kg N`}</b></span>
              <input type="range" min={LIMITS.wSoilUsd[0]} max={LIMITS.wSoilUsd[1]} step={0.1} value={s.wSoilUsd} aria-valuetext={`${s.wSoilUsd} US dollars per kilogram of soil nitrogen gained`} onChange={(e) => set({ wSoilUsd: Number(e.target.value) })} />
              <span className="wi-ticks"><span>0</span><span>≈ fertilizer price</span><span>5</span></span>
            </label>
            <label className="wi-slider">
              <span className="wi-label"><Coins size={15} /> Low-input & climate <b>{s.wCarbonUsdPerT === 0 ? 'not valued' : `${Math.round(s.wCarbonUsdPerT)} USD/t CO₂e`}</b></span>
              <input type="range" min={LIMITS.wCarbonUsdPerT[0]} max={LIMITS.wCarbonUsdPerT[1]} step={5} value={s.wCarbonUsdPerT} aria-valuetext={`${s.wCarbonUsdPerT} US dollars per tonne of CO2 equivalent`} onChange={(e) => set({ wCarbonUsdPerT: Number(e.target.value) })} />
              <span className="wi-ticks"><span>0</span><span>150</span><span>300</span></span>
            </label>
            <div className="wi-slider">
              <span className="wi-label">Plan length</span>
              <Seg label="Plan length in years" value={String(s.years) as '2' | '3' | '4' | '5'} onChange={(v) => set({ years: Number(v) })} options={(['2', '3', '4', '5'] as const).map((v) => ({ v, label: `${v} yr` }))} />
            </div>
            <label className="wi-slider">
              <span className="wi-label">Soil mineral N at sowing, kg/ha</span>
              <NumInput value={s.soilN} min={0} step={5} label="Soil mineral N at sowing" onChange={(v) => set({ soilN: v ?? 0 })} />
              <span className="mini">From a soil test if you have one; 50 is a typical default.</span>
            </label>
            <label className="row" style={{ gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={s.intercrops} onChange={(e) => set({ intercrops: e.target.checked })} />
              Consider cereal–legume mixtures (needs grain separation)
            </label>
          </div>

          <div className="wi-results">
            {sim?.truncated && <Callout tone="warn">Too many crops for a {s.years}-year search on this device; showing {Math.ceil(sim.seasons / (double ? 2 : 1))} years. Remove crops in Resources or shorten the plan.</Callout>}
            {best ? (
              <p className="wi-headline">
                Best for your priorities: <b>{best.labels.join(' → ')}</b>. {fmtApprox(best.totals.net, cur)}/ha net over {s.years} years, {fmtNum(best.totals.nFert, 0)} kg fertilizer N/ha
                {vsUsual != null && Number.isFinite(vsUsual) ? <>, {vsUsual >= 0 ? `${fmtApprox(vsUsual, cur)} more` : `${fmtApprox(-vsUsual, cur)} less`} than repeating your usual plan</> : null}.
              </p>
            ) : <Callout tone="warn">No rotation satisfies the rules with the crops available here.</Callout>}
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Rotation</th><th className="num">Net, {cur}/ha</th><th className="num">N fert, kg/ha</th><th className="num">Soil N</th><th className="num">t CO₂e/ha</th></tr></thead>
                <tbody>
                  {plans.map((p, i) => (
                    <tr key={planKey(p)}>
                      <td>{swatch(p)}{i + 1}</td>
                      <td className="wrap"><OptionSeq rows={p.rows} />{p.pareto && <span className="chip" title="No other allowed rotation is better on cash, soil N and emissions at once">Pareto-optimal</span>}</td>
                      <td className="num">{fmtMoney(p.totals.net, cur)}</td>
                      <td className="num">{fmtNum(p.totals.nFert, 0)}</td>
                      <td className="num">{signed(p.totals.soilNChange)}</td>
                      <td className="num">{fmtNum(p.totals.co2e / 1000, 2)}</td>
                    </tr>
                  ))}
                  {usual && (
                    <tr className="dim">
                      <td>—</td>
                      <td className="wrap"><b>Your usual plan, repeated</b><OptionSeq rows={usual.rows} />{usual.blocked && <span className="mini">Not a rotation Field Shift would rank: {usual.blocked}.</span>}</td>
                      <td className="num">{fmtMoney(usual.plan.totals.net, cur)}</td>
                      <td className="num">{fmtNum(usual.plan.totals.nFert, 0)}</td>
                      <td className="num">{signed(usual.plan.totals.soilNChange)}</td>
                      <td className="num">{fmtNum(usual.plan.totals.co2e / 1000, 2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mini">{ranked?.considered.toLocaleString('en-US')} rotations allowed by Field Shift’s rules were simulated ({sim?.evaluatedRows.toLocaleString('en-US')} crop-seasons). Score = net cash + soil-N gain × soil weight − CO₂e × climate weight, each later year discounted.</p>
          </div>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="card section">
          <div className="card-head"><CardTitle icon={<Leaf />}>Soil mineral N through the plan</CardTitle><SoilTag /></div>
          <SoilNChart plans={plans} names={plans.slice(0, 3).map((_, i) => `#${i + 1}`)} double={double} colors={colors} />
          <p className="chart-cap">kg mineral N/ha at each sowing and after the last harvest, top three rotations. Legumes and mixtures leave N behind; cereals draw it down. Exact values in the tables below.</p>
        </section>
      )}

      <YieldCalibrationCard ctx={ctx} onFarm={() => go('farm')} />

      {plans.map((p, i) => (
        <details key={planKey(p)} className="card section disclose" open={i === 0}>
          <summary>{swatch(p)}#{i + 1} · {p.labels.join(' → ')}<span className="mini hide-sm" style={{ fontWeight: 400 }}>season by season</span></summary>
          <div className="body"><SeasonTable rows={p.rows} cur={cur} double={double} /></div>
        </details>
      ))}

      <section className="card section">
        <CoverageNotes ctx={ctx} />
        {ctx.pack.mode === 'double' && ctx.modeledWindows.length < ctx.windows.length && <p className="mini">Only the {ctx.modeledWindows.map((i) => ctx.windows[i].label).join(' and ')} is modeled here; the other season’s crops are not in the trials, so their effect on soil N between modeled seasons is not counted.</p>}
        <ModelCaption bundle={bundle} />
        <p className="mini">Prices and input costs come from your farm (FAOSTAT and the {ctx.pack.short} template, editable in Resources); rotation rules are the same as on Compare. Fertilizer N is priced at {fmtMoney(ctx.nPricePerKg, cur)}/kg N ({ctx.nPriceSource}).</p>
      </section>
    </div>
  );
}
