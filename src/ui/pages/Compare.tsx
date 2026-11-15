import { Fragment, useRef, useState, type ReactNode } from 'react';
import type { Route } from '../../App';
import { ArrowDown, ArrowLeft, ArrowRight, Ban, CloudSunRain, Coins } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { EngineOutput, PlanResult } from '../../engine/plan';
import { CROPS, cropEmoji, cropName } from '../../data/crops';
import { fmtMoney, fmtNum } from '../../domain/units';
import { fmtDayMonth, fmtDate } from '../../domain/dates';
import { CashTimeline, CostChart, RangeBar, ReplayChart } from '../components/charts';
import { BudgetBar, CardTitle, Callout, Disclaimer, Money, NasaLoading, pct, ReasonList, Ref, Seg, StatRows, StatusBadge, Tag } from '../components/common';

const PRIORITY_LABEL = { cost: 'lowest cost', climate: 'lowest climate exposure', continuity: 'continuity', return: 'modeled return' };
const BEST_LABEL = { cost: 'Best for lowest cost', climate: 'Best for climate risk', continuity: 'Best for continuity', return: 'Best for modeled return' };
const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
/** Budget in the sub-line: compact above a million so the line never wraps. */
const nb = (x: number) => (Math.abs(x) >= 1e6 ? `${(x / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M` : n0(x));

export function Seq({ crops, size }: { crops: [string, string]; size?: 'sm' }) {
  return (
    <p className={`seq ${size ?? ''}`} aria-label={`${cropName(crops[0])} then ${cropName(crops[1])}`}>
      <span className="crop"><span className="em" aria-hidden>{cropEmoji(crops[0])}</span>{cropName(crops[0])}</span>
      <span className="arrow" aria-hidden><ArrowRight size={size ? 14 : 18} /></span>
      <span className="crop"><span className="em" aria-hidden>{cropEmoji(crops[1])}</span>{cropName(crops[1])}</span>
    </p>
  );
}

/** Sub-line under the cash-cost hero number; color only for the budget verdict. */
function BudgetLine({ p, cur }: { p: PlanResult; cur: string }) {
  const b = p.budget;
  const budget = b.cap + b.inflowsTotal;
  if (b.status === 'unverified') return <span className="sub"><span className="warn-t">Budget not verified:</span> {b.missingEssential.length} price{b.missingEssential.length === 1 ? '' : 's'} missing</span>;
  if (b.status === 'timing' && b.timingViolation) return <span className="sub"><span className="bad-t">{fmtMoney(b.timingViolation.needed - b.timingViolation.available, cur)} short</span> by {fmtDayMonth(b.timingViolation.date)}</span>;
  if (b.headroom < 0) return <span className="sub"><span className="bad-t">{fmtMoney(-b.headroom, cur)} over</span> the {nb(budget)} budget</span>;
  return <span className="sub"><span className="good-t">{fmtMoney(b.headroom, cur)} left</span> of {nb(budget)} budget</span>;
}

function harvestText(p: PlanResult) {
  const parts = p.seasons.map((s, k) => (s.cropId === 'fallow' ? 'fallow' : `${fmtNum(p.outcome.yields[k]?.median, 1)} t`));
  return parts.join(' + ');
}

/** The plan card: one hero number (cash cost), budget bar, three stat rows, sowing lines. Used by Compare, Overview and Report. */
export function PlanCard({ p, cur, label, tone, best, onWhy, selected, compact }: { p: PlanResult; cur: string; label: string; tone?: 'brand'; best?: boolean; onWhy?: () => void; selected?: boolean; compact?: boolean }) {
  const severe = Math.round(p.outcome.pSevereAny * p.outcome.pairs);
  return (
    <article className={`card plan ${best ? 'best' : ''} ${compact ? 'preview' : ''}`} aria-label={`${label}: ${cropName(p.crops[0])} then ${cropName(p.crops[1])}`}>
      <div className="plan-top"><span className={`caption ${tone === 'brand' ? 'brand' : ''}`}>{label}</span><StatusBadge status={p.budget.status} /></div>
      <Seq crops={p.crops} />
      <div className="plan-cost">
        <div className="stat">
          <span className="caption">Cash cost</span>
          <span className="hero-num"><Money v={p.budget.totalCash} cur={cur} /></span>
        </div>
        <BudgetBar cost={p.budget.totalCash} cap={p.budget.cap + p.budget.inflowsTotal} status={p.budget.status} />
        <BudgetLine p={p} cur={cur} />
      </div>
      {!compact && <>
        <div className="group" style={{ marginTop: 0 }}>
          <StatRows rows={[
            ['Due before first sowing', fmtMoney(p.budget.upfront, cur)],
            ['Harvest, typical year', harvestText(p)],
            ['Severe water stress', `${severe} of ${p.outcome.pairs} years`],
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

export function disclaimerText(engine: EngineOutput, edited: boolean) {
  const unreviewed = engine.pack.reviewStatus !== 'reviewed';
  const lead = !edited && unreviewed ? 'Demo results: synthetic prices and an unreviewed rule pack.' : unreviewed ? 'Demo results: an unreviewed rule pack and partly synthetic prices.' : 'Input costs include synthetic template prices.';
  return `${lead} Climate risk is a replay of past seasons, not a forecast.`;
}

type DetailTab = 'reasons' | 'cash' | 'replay' | 'lines';

export function ComparePage({ go }: { go: (r: Route) => void }) {
  const { engine, engineError, scenario: sc, data } = useApp();
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('reasons');
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [dot, setDot] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const head = (
    <div className="page-head">
      <div>
        <span className="caption">Step 3 of 4</span>
        <h1>Compare two-season plans</h1>
        {engine && <p>{engine.areaHa.toFixed(2)} ha · {engine.baseline.seasons[0].year === engine.baseline.seasons[1].year ? `${engine.baseline.seasons[0].year} ${engine.windows.map((w) => w.label).join(' + ')}` : `${engine.baseline.seasons[0].year}–${engine.baseline.seasons[1].year}`} · {fmtMoney(engine.baseline.budget.cap, sc.currency)} spendable{engine.baseline.budget.inflowsTotal ? ` + ${fmtMoney(engine.baseline.budget.inflowsTotal, sc.currency)} confirmed inflows` : ''} · ranked by {PRIORITY_LABEL[sc.priority]}</p>}
      </div>
      <div className="page-actions"><button className="btn" onClick={() => go('resources')}><ArrowLeft /> Edit resources</button><button className="btn primary" onClick={() => go('evidence')}>Review evidence <ArrowRight /></button></div>
    </div>
  );
  if (engineError) return <div>{head}<Callout tone="bad">Engine error: {engineError}</Callout></div>;
  if (!engine) return <div>{head}{data.weatherStatus === 'error' ? <Callout tone="bad">NASA POWER data could not be loaded for this location ({data.weatherError}). Try “Refresh live NASA data” or another location.</Callout> : <NasaLoading place={sc.location.label} />}</div>;

  const plans = [engine.baseline, ...engine.alternatives];
  const chosen = plans.find((p) => p.id === sel) ?? engine.allPlans.find((p) => p.id === sel) ?? (engine.alternatives[0] ?? engine.baseline);
  const cur = sc.currency;
  const edited = Object.keys(sc.priceOverrides).length > 0;
  const risks = Object.values(engine.risks).sort((a, b) => b.medianRel - a.medianRel);
  const nSeasons = Object.values(engine.risks)[0]?.years.length ?? 0;
  const labelOf = (p: PlanResult, i: number) => (p.isBaseline ? 'Your usual plan' : i === 1 ? BEST_LABEL[sc.priority] : p.label || 'Option B');
  const showWhy = (id: string) => { setSel(id); requestAnimationFrame(() => document.getElementById('detail')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })); };
  const onRowScroll = () => {
    const el = rowRef.current; if (!el) return;
    const w = el.scrollWidth / Math.max(1, plans.length);
    setDot(Math.round(el.scrollLeft / w));
  };
  const priceSrc = (c: string) => { const s = engine.prices[c]?.source; return s === 'faostat-country' ? 'FAOSTAT' : s === 'faostat-median' ? 'FAOSTAT median' : s === 'farmer' ? 'yours' : 'placeholder'; };
  const notesDetails = engine.notes.map((n) => (
    <span key={n.code}>{n.code === 'UNREVIEWED_RULES' && <><span className="chip">{engine.pack.reviewStatus}</span>{' '}</>}{n.text}</span>
  ));

  return (
    <div>
      {head}
      <Disclaimer details={notesDetails}>{disclaimerText(engine, edited)}</Disclaimer>

      {engine.alternatives.length === 0 && (
        <div style={{ marginTop: 16 }}>
          <Callout tone="warn"><b>No feasible alternative under the stated constraints.</b> Of {engine.allPlans.length} rotations screened, none passes the rules and the budget. Smallest useful next steps: raise funds or lower the reserve, reduce the planted area, edit a price you can source cheaper, mark more crops as sellable, or allow a fallow season. The exclusions below show exactly why.</Callout>
        </div>
      )}

      <div className="plan-row" ref={rowRef} onScroll={onRowScroll} style={{ marginTop: 24 }}>
        {plans.map((p, i) => (
          <PlanCard key={p.id} p={p} cur={cur} label={labelOf(p, i)} tone={i === 1 ? 'brand' : undefined} best={i === 1} selected={chosen.id === p.id} onWhy={() => showWhy(p.id)} />
        ))}
      </div>
      <div className="plan-dots" aria-hidden>{plans.map((p, i) => <i key={p.id} className={i === dot ? 'on' : ''} />)}</div>

      {/* What-if panel slot: the climate what-if panel mounts here, right after the plan cards. */}

      <div className="grid g2 section">
        <div className="card">
          <div className="card-head"><CardTitle icon={<Coins />}>Cash cost vs budget</CardTitle><Tag t="synthetic">{edited ? 'prices: partly yours' : 'Synthetic demo'}</Tag></div>
          <CostChart plans={plans} cap={engine.baseline.budget.cap + engine.baseline.budget.inflowsTotal} currency={cur} />
          <p className="chart-cap">Cash cost per plan by category, {cur}, both seasons. Dashed line: spendable budget plus confirmed inflows.</p>
        </div>
        <div className="card">
          <div className="card-head"><CardTitle icon={<CloudSunRain />}>Water-limited yield by crop</CardTitle><Tag t="nasa" /></div>
          <div className="table-wrap sticky-first">
            <table>
              <thead><tr><th>Crop</th><th>Yield</th><th className="num">Severe</th><th className="num">Heat</th>{risks.some((r) => CROPS[r.cropId].frostSensitive) && <th className="num">Frost</th>}<th className="num">Sowing</th></tr></thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={`${r.cropId}:${r.seasonLabel}`}>
                    <td>{CROPS[r.cropId].emoji} {cropName(r.cropId)}{engine.windows.length > 1 && r.seasonLabel ? <span className="muted"> · {r.seasonLabel}</span> : null}</td>
                    <td><div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><RangeBar p20={r.p20Rel} med={r.medianRel} p80={r.p80Rel} width={72} /><span>{pct(r.medianRel)}</span></div></td>
                    <td className="num">{pct(r.pSevere)}</td>
                    <td className="num">{pct(r.pHeat)}</td>
                    {risks.some((x) => CROPS[x.cropId].frostSensitive) && <td className="num">{CROPS[r.cropId].frostSensitive ? pct(r.pFrost) : '—'}</td>}
                    <td className="num">{fmtDayMonth(r.medianSowing)}{r.pNoOnset > 0 ? <span className="muted"> · no onset {pct(r.pNoOnset)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chart-cap">Modeled: FAO-56 soil-water balance replayed over {nSeasons} NASA POWER seasons. Dot median, bar 20th–80th percentile. Severe &lt;50% of attainable; heat ≥3 hot days near flowering; frost Tmin ≤ 0 °C.</p>
        </div>
      </div>

      <section className="card section" id="detail" aria-label="Why this result">
        <div className="card-head">
          <div><span className="caption">Why this result</span><Seq crops={chosen.crops} size="sm" /></div>
          <select className="input sm" style={{ width: 'auto', maxWidth: '100%' }} value={chosen.id} onChange={(e) => setSel(e.target.value)} aria-label="Plan to explain">
            {[engine.baseline, ...engine.alternatives, ...engine.allPlans.filter((p) => !p.isBaseline && !engine.alternatives.some((a) => a.id === p.id))].map((p) => <option key={p.id} value={p.id}>{p.isBaseline ? 'Usual: ' : p.label ? `${p.label}: ` : p.feasible ? '' : '✕ '}{cropName(p.crops[0])} → {cropName(p.crops[1])}</option>)}
          </select>
        </div>
        <Seg label="Detail" role="tablist" value={tab} onChange={setTab} options={[{ v: 'reasons', label: 'Reasons' }, { v: 'cash', label: 'Cash' }, { v: 'replay', label: 'Climate replay' }, { v: 'lines', label: 'Cost lines' }]} />
        <div style={{ marginTop: 24 }}>
          {tab === 'reasons' && (
            <div className="grid g2" style={{ gap: 32 }}>
              <div className="stack">
                <StatRows rows={[
                  ['Season 1 cash cost', fmtMoney(chosen.budget.bySeason[0], cur)],
                  ['Season 2 cash cost', fmtMoney(chosen.budget.bySeason[1], cur)],
                  ['Due before first sowing', fmtMoney(chosen.budget.upfront, cur)],
                  chosen.outcome.net && ['Modeled net, typical year', fmtMoney(chosen.outcome.net.median, cur)],
                  chosen.outcome.net && ['Modeled net, bad year', fmtMoney(chosen.outcome.net.p20, cur)],
                ]} />
                <div>
                  <div className="spread" style={{ marginBottom: 8 }}><span className="caption">Harvest, whole field</span><Tag t="modeled" /></div>
                  <StatRows rows={chosen.seasons.map((s, k) => {
                    const y = chosen.outcome.yields[k];
                    return [<>{CROPS[s.cropId].emoji} {s.cropId === 'fallow' ? 'Fallow' : cropName(s.cropId)}</>, s.cropId === 'fallow' ? 'no harvest' : <span className="row" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>{s.risk && <RangeBar p20={s.risk.p20Rel} med={s.risk.medianRel} p80={s.risk.p80Rel} width={72} />}{fmtNum(y?.p20, 1)}–{fmtNum(y?.p80, 1)} t</span>] as [ReactNode, ReactNode];
                  })} />
                  <p className="mini" style={{ marginTop: 8 }}>Range is a bad year (20th percentile) to a good year (80th). Sale prices: {chosen.crops.filter((c) => c !== 'fallow').map((c) => `${cropName(c)} ${fmtMoney(engine.prices[c]?.perT, cur)}/t (${priceSrc(c)})`).join(' · ')}.</p>
                </div>
              </div>
              <div>
                <div className="caption" style={{ marginBottom: 8 }}>Reasons, with rule references</div>
                <ReasonList reasons={chosen.reasons} />
              </div>
            </div>
          )}
          {tab === 'cash' && (
            <div className="stack">
              <CashTimeline b={chosen.budget} currency={cur} />
              <p className="chart-cap" style={{ marginTop: 0 }}>Cumulative cash out against cash available, {cur}. Harvest income and credit are not assumed.</p>
              {chosen.budget.timingViolation && <Callout tone="bad">By {fmtDate(chosen.budget.timingViolation.date)} you would need {fmtMoney(chosen.budget.timingViolation.needed, cur)} but only {fmtMoney(chosen.budget.timingViolation.available, cur)} is available.</Callout>}
            </div>
          )}
          {tab === 'replay' && (
            <div>
              <ReplayChart plan={chosen} />
              <p className="chart-cap">Modeled water-limited yield, % of attainable, if this plan had been grown in each pair of past NASA POWER seasons. Dashed line: severe-stress threshold. A replay, not a forecast.</p>
            </div>
          )}
          {tab === 'lines' && (
            <div>
              <div className="spread" style={{ marginBottom: 8 }}><span className="mini">Traceable: quantity × unit price. Tap a row on a phone for details.</span>{chosen.budget.lines.some((l) => l.overridden) ? <Tag t="farmer">partly your prices</Tag> : <Tag t="synthetic" />}</div>
              <div className="table-wrap">
                <table className="cost-lines">
                  <thead><tr><th className="hide-sm">Season</th><th>Item</th><th className="num hide-sm">Quantity</th><th className="num hide-sm">Unit price, {cur}</th><th className="num">Total, {cur}</th><th className="num">Due</th></tr></thead>
                  <tbody>
                    {chosen.budget.lines.map((l, i) => (
                      <Fragment key={i}>
                        <tr className={l.cash ? '' : 'dim'} onClick={() => setOpenLine(openLine === i ? null : i)}>
                          <td className="hide-sm">S{l.season} {cropEmoji(l.cropId)}</td>
                          <td className="wrap">{l.label}{!l.cash && ' (non-cash)'}</td>
                          <td className="num hide-sm">{fmtNum(l.qty, 1)} {l.unit}</td>
                          <td className="num hide-sm">{l.unitPrice == null ? <span className="warn-t">missing</span> : <>{fmtNum(l.unitPrice, 2)}{l.overridden && <span className="muted" title="Your price"> · yours</span>}</>}</td>
                          <td className="num">{l.total == null ? '—' : n0(l.total)}</td>
                          <td className="num">{fmtDayMonth(l.dueDate)}</td>
                        </tr>
                        {openLine === i && <tr className="show-sm"><td colSpan={6} className="wrap mini">Season {l.season} {cropName(l.cropId)} · {fmtNum(l.qty, 1)} {l.unit} × {l.unitPrice == null ? 'missing price' : fmtMoney(l.unitPrice, cur)}{l.overridden ? ' (your price)' : ''} · due {fmtDate(l.dueDate)}</td></tr>}
                      </Fragment>
                    ))}
                    <tr className="total"><td className="hide-sm" /><td>Cash total</td><td className="hide-sm" /><td className="hide-sm" /><td className="num">{n0(chosen.budget.totalCash)}</td><td /></tr>
                  </tbody>
                </table>
              </div>
              <p className="mini" style={{ marginTop: 8 }}>Non-cash family labor, shown for information only: {fmtMoney(chosen.budget.totalNonCash, cur)}.</p>
            </div>
          )}
        </div>
      </section>

      <details className="card section disclose">
        <summary><Ban />Excluded rotations ({engine.excluded.length})<span className="mini hide-sm" style={{ fontWeight: 400 }}>each with the rule that blocks it</span></summary>
        <div className="body table-wrap">
          <table>
            <thead><tr><th>Rotation</th><th className="num">Cash cost, {cur}</th><th>Blocking reason</th></tr></thead>
            <tbody>
              {engine.excluded.map((p) => {
                const blocks = p.reasons.filter((r) => r.severity === 'block');
                return (
                  <tr key={p.id}>
                    <td style={{ verticalAlign: 'top', paddingTop: 10 }}>{cropEmoji(p.crops[0])} {cropName(p.crops[0])} → {cropEmoji(p.crops[1])} {cropName(p.crops[1])}</td>
                    <td className="num" style={{ verticalAlign: 'top', paddingTop: 10 }}>{n0(p.budget.totalCash)}</td>
                    <td className="wrap" style={{ paddingTop: 10, paddingBottom: 10 }}>
                      {blocks.map((r, k) => <div key={k}>{r.text}{r.refs.length > 0 && <span className="refs" style={{ marginLeft: 6 }}>{r.refs.slice(0, 2).map((x) => <Ref key={x} id={x} />)}</span>}</div>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
