import { useState, type ReactNode } from 'react';
import type { Route } from '../../App';
import { ArrowDown, ArrowLeft, ArrowRight, Ban, CheckCircle2, Clock, CloudSunRain, Coins, HelpCircle, XCircle } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { PlanResult } from '../../engine/plan';
import { CROPS, cropEmoji, cropName } from '../../data/crops';
import { fmtMoney, fmtNum } from '../../domain/units';
import { fmtDayMonth, fmtDate } from '../../domain/dates';
import { CashTimeline, CostChart, RangeBar, ReplayChart } from '../components/charts';
import { CardTitle, Callout, Meter, NasaLoading, pct, ReasonList, Tag } from '../components/common';
import { WhatIfPanel } from '../components/WhatIf';

const STATUS: Record<string, { cls: string; t: string; i: ReactNode }> = {
  affordable: { cls: 'ok', t: 'Affordable', i: <CheckCircle2 /> }, unaffordable: { cls: 'bad', t: 'Over budget', i: <XCircle /> }, unverified: { cls: 'warn', t: 'Budget not verified', i: <HelpCircle /> }, timing: { cls: 'bad', t: 'Cash-timing gap', i: <Clock /> },
};
const PRIORITY_LABEL = { cost: 'lowest cost', climate: 'lowest climate exposure', continuity: 'continuity', return: 'modeled return' };

function Seq({ crops }: { crops: [string, string] }) {
  return <div className="seq"><span className="crop">{cropEmoji(crops[0])} {cropName(crops[0])}</span><span className="arrow"><ArrowRight size={16} /></span><span className="crop">{cropEmoji(crops[1])} {cropName(crops[1])}</span></div>;
}

function PlanCard({ p, cur, onWhy, selected, priority, isBest, prices }: { p: PlanResult; cur: string; onWhy: () => void; selected: boolean; priority: string; isBest: boolean; prices?: Record<string, { perT: number | null; source: string }> }) {
  const st = STATUS[p.budget.status];
  return (
    <div className={`card plan ${p.isBaseline ? 'baseline' : ''} ${isBest ? 'best' : ''}`} style={selected ? { outline: '3px solid #9cc3ff' } : undefined}>
      <span className="ribbon">{p.isBaseline ? 'Your usual plan' : `${p.label}${isBest ? ` · best for ${PRIORITY_LABEL[priority as keyof typeof PRIORITY_LABEL]}` : ''}`}</span>
      <div className="spread" style={{ marginTop: 6 }}><Seq crops={p.crops} /><span className={`badge ${st.cls}`}>{st.i}{st.t}</span></div>
      <div className="mini">
        {p.seasons.map((s) => (
          <div key={s.season}>
            <b>{s.year}</b> <span className="chip nasa" style={{ padding: '1px 7px' }}>{s.seasonLabel}</span> {CROPS[s.cropId].emoji} {s.cropId === 'fallow' ? 'rest season' : <>sow ≈ {fmtDayMonth(s.sowing)}{s.risk?.p20Sowing && s.risk.p80Sowing ? <> (typical {fmtDayMonth(s.risk.p20Sowing)}–{fmtDayMonth(s.risk.p80Sowing)})</> : null}, mature ≈ {fmtDayMonth(s.maturity)}</>}
          </div>
        ))}
      </div>
      <div className="split">
        <div><div className="t">Cash cost (2 seasons)</div><div className="v">{fmtMoney(p.budget.totalCash, cur)}</div></div>
        <div><div className="t">Headroom</div><div className="v" style={{ color: p.budget.headroom >= 0 ? 'var(--brand)' : 'var(--red)' }}>{p.budget.headroom >= 0 ? '+' : ''}{fmtMoney(p.budget.headroom, cur)}</div></div>
        <div><div className="t">Due by first sowing</div><div className="v">{fmtMoney(p.budget.upfront, cur)}</div></div>
        <div><div className="t">Season 1 / 2</div><div className="v" style={{ fontSize: '.9rem' }}>{fmtMoney(p.budget.bySeason[0], cur)} / {fmtMoney(p.budget.bySeason[1], cur)}</div></div>
      </div>
      <div>
        <div className="spread mini"><b>Modeled harvest (whole field)</b><Tag t="modeled" /></div>
        {p.seasons.map((s, k) => {
          const y = p.outcome.yields[k];
          return (
            <div key={k} className="spread mini" style={{ marginTop: 4 }}>
              <span>{CROPS[s.cropId].emoji} {s.cropId === 'fallow' ? 'Fallow — no harvest' : <>median <b>{fmtNum(y?.median, 2)} t</b> · bad year {fmtNum(y?.p20, 2)} · good {fmtNum(y?.p80, 2)}</>}</span>
              {s.risk && s.cropId !== 'fallow' && <RangeBar p20={s.risk.p20Rel} med={s.risk.medianRel} p80={s.risk.p80Rel} width={90} />}
            </div>
          );
        })}
        {p.outcome.net && <div className="mini" style={{ marginTop: 6 }}>Modeled net after cash costs: <b>{fmtMoney(p.outcome.net.median, cur)}</b> (bad year {fmtMoney(p.outcome.net.p20, cur)})</div>}
        {prices && <div className="mini" style={{ marginTop: 4, color: 'var(--ink-3)' }}>Sale prices: {p.crops.filter((c) => c !== 'fallow').map((c) => `${cropName(c)} ${fmtMoney(prices[c]?.perT, cur)}/t (${prices[c]?.source === 'faostat-country' ? 'FAOSTAT' : prices[c]?.source === 'faostat-median' ? 'FAOSTAT median' : prices[c]?.source === 'farmer' ? 'yours' : 'placeholder'})`).join(' · ')}</div>}
      </div>
      <div>
        <div className="spread mini"><b>Severe water-stress risk</b><span>{pct(p.outcome.pSevereAny)} of {p.outcome.pairs} replayed season pairs</span></div>
        <Meter value={p.outcome.pSevereAny} />
      </div>
      <ReasonList reasons={p.reasons} max={4} />
      <button className="btn sm" onClick={onWhy}>{selected ? <>Showing details <ArrowDown size={14} /></> : <>See why <ArrowRight size={14} /></>}</button>
    </div>
  );
}

export function ComparePage({ go }: { go: (r: Route) => void }) {
  const { engine, engineError, scenario: sc, data } = useApp();
  const [sel, setSel] = useState<string | null>(null);
  if (engineError) return <Callout tone="bad">Engine error: {engineError}</Callout>;
  if (!engine) return data.weatherStatus === 'error' ? <Callout tone="bad">NASA POWER data could not be loaded for this location ({data.weatherError}). Try “Refresh live NASA data” or another location.</Callout> : <NasaLoading place={sc.location.label} />;
  const plans = [engine.baseline, ...engine.alternatives];
  const chosen = plans.find((p) => p.id === sel) ?? engine.allPlans.find((p) => p.id === sel) ?? (engine.alternatives[0] ?? engine.baseline);
  const cur = sc.currency;
  const risks = Object.values(engine.risks).sort((a, b) => b.medianRel - a.medianRel);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Step 3 of 4</div>
          <h1>Compare two-season plans</h1>
          <p>{engine.pack.name}. {engine.areaHa.toFixed(2)} ha · {engine.baseline.seasons[0].year === engine.baseline.seasons[1].year ? `${engine.baseline.seasons[0].year} · ${engine.windows.map((w) => w.label).join(" + ")}` : `${engine.baseline.seasons[0].year}–${engine.baseline.seasons[1].year}`} · spendable {fmtMoney(engine.baseline.budget.cap, cur)}{engine.baseline.budget.inflowsTotal ? ` + ${fmtMoney(engine.baseline.budget.inflowsTotal, cur)} confirmed inflows` : ''}. Ranked by <b>{PRIORITY_LABEL[sc.priority]}</b>.</p>
        </div>
        <div className="row"><button className="btn" onClick={() => go('resources')}><ArrowLeft size={16} /> Edit resources</button><button className="btn primary" onClick={() => go('evidence')}>Review evidence <ArrowRight size={16} /></button></div>
      </div>

      <Callout tone="info"><ul className="notes">{engine.notes.map((n, i) => <li key={i}>{n.text}</li>)}</ul></Callout>

      {engine.alternatives.length === 0 && (
        <Callout tone="warn"><b>No feasible alternative under the stated constraints.</b> Of {engine.allPlans.length} rotations screened, none passes the rules and the budget. Smallest useful next steps: raise funds or lower the reserve, reduce the planted area, edit a price you can source cheaper, mark more crops as sellable, or allow a fallow season. The exclusions below show exactly why.</Callout>
      )}

      <div className="grid g3" style={{ marginTop: 18 }}>
        {plans.map((p, i) => <PlanCard key={p.id} p={p} cur={cur} prices={engine.prices} priority={sc.priority} isBest={i === 1} selected={chosen.id === p.id} onWhy={() => setSel(p.id)} />)}
      </div>

      <WhatIfPanel />

      <div className="grid g2 section">
        <div className="card">
          <div className="card-head"><CardTitle icon={<Coins size={17} />} tone="amber">Cash cost vs spendable budget</CardTitle><Tag t="synthetic">prices: {Object.keys(sc.priceOverrides).length ? 'partly yours' : 'synthetic'}</Tag></div>
          <CostChart plans={plans} cap={engine.baseline.budget.cap + engine.baseline.budget.inflowsTotal} currency={cur} />
        </div>
        <div className="card">
          <div className="card-head"><CardTitle icon={<CloudSunRain size={17} />} tone="sky">Water-limited yield by crop here</CardTitle><Tag t="nasa" /><Tag t="modeled" /></div>
          <p className="mini">FAO-56 daily soil-water balance replayed over every complete NASA POWER season, sown on that year’s detected date. Dot = median, bar = 20th–80th percentile, as % of attainable yield.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Crop</th><th>Water-limited yield</th><th className="num">Severe</th><th className="num">Heat</th><th className="num">Frost</th><th>Typical sowing</th></tr></thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.cropId}>
                    <td>{CROPS[r.cropId].emoji} {cropName(r.cropId)}{engine.windows.length > 1 && r.seasonLabel ? <span className="mini"> · {r.seasonLabel}</span> : null}</td>
                    <td><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><RangeBar p20={r.p20Rel} med={r.medianRel} p80={r.p80Rel} width={110} /><span className="mini">{pct(r.medianRel)}</span></div></td>
                    <td className="num">{pct(r.pSevere)}</td>
                    <td className="num">{pct(r.pHeat)}</td>
                    <td className="num">{CROPS[r.cropId].frostSensitive ? pct(r.pFrost) : '—'}</td>
                    <td className="mini">{fmtDayMonth(r.medianSowing)}{r.pNoOnset > 0 ? ` · no onset ${pct(r.pNoOnset)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mini" style={{ marginTop: 6 }}>Severe = &lt;50% of attainable · Heat = ≥3 days above the crop’s exploratory threshold around flowering · Frost = Tmin ≤ 0 °C after emergence. Historical scenario, not a forecast.</p>
        </div>
      </div>

      <div className="card section" id="detail">
        <div className="card-head">
          <div><div className="eyebrow">Why this result?</div><h3 style={{ margin: 0 }}><Seq crops={chosen.crops} /></h3></div>
          <select className="input sm" style={{ width: 'auto' }} value={chosen.id} onChange={(e) => setSel(e.target.value)}>
            {[engine.baseline, ...engine.alternatives, ...engine.allPlans.filter((p) => !engine.alternatives.some((a) => a.id === p.id))].map((p) => <option key={p.id} value={p.id}>{p.isBaseline ? 'Usual: ' : p.label ? `${p.label}: ` : p.feasible ? '' : '✕ '}{cropName(p.crops[0])} → {cropName(p.crops[1])}</option>)}
          </select>
        </div>
        <div className="grid g2">
          <div>
            <h4>All reasons</h4>
            <ReasonList reasons={chosen.reasons} />
            <h4 style={{ marginTop: 14 }}>Cash timeline</h4>
            <CashTimeline b={chosen.budget} currency={cur} />
            {chosen.budget.timingViolation && <Callout tone="bad">By {fmtDate(chosen.budget.timingViolation.date)} you would need {fmtMoney(chosen.budget.timingViolation.needed, cur)} but only {fmtMoney(chosen.budget.timingViolation.available, cur)} is available.</Callout>}
          </div>
          <div>
            <h4>Historical replay — each bar is one past season pair</h4>
            <ReplayChart plan={chosen} />
            <p className="mini">If you had followed this plan in each pair of consecutive past years, the modeled water-limited yield would have been as shown. Red line = severe-stress threshold.</p>
          </div>
        </div>
        <h4 style={{ marginTop: 10 }}>Cost lines (traceable: quantity × unit price)</h4>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Season</th><th>Item</th><th className="num">Quantity</th><th className="num">Unit price</th><th className="num">Total</th><th>Due</th><th>Source</th></tr></thead>
            <tbody>
              {chosen.budget.lines.map((l, i) => (
                <tr key={i} className={l.cash ? '' : 'dim'}>
                  <td>S{l.season} {cropEmoji(l.cropId)}</td>
                  <td>{l.label}{!l.cash && ' (non-cash)'}</td>
                  <td className="num">{fmtNum(l.qty, 1)} {l.unit}</td>
                  <td className="num">{l.unitPrice == null ? <span className="badge warn">missing</span> : fmtMoney(l.unitPrice, cur)}</td>
                  <td className="num">{fmtMoney(l.total, cur)}</td>
                  <td>{fmtDate(l.dueDate)}</td>
                  <td>{l.overridden ? <Tag t="farmer">your price</Tag> : <Tag t="synthetic" />}</td>
                </tr>
              ))}
              <tr><td colSpan={4}><b>Cash total</b> (non-cash family labor shown for information: {fmtMoney(chosen.budget.totalNonCash, cur)})</td><td className="num"><b>{fmtMoney(chosen.budget.totalCash, cur)}</b></td><td colSpan={2} /></tr>
            </tbody>
          </table>
        </div>
      </div>

      <details className="card section">
        <summary><span className="ic red"><Ban size={17} /></span>Excluded rotations ({engine.excluded.length}) — and the exact reason for each</summary>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Rotation</th><th>Cash cost</th><th>Blocking reasons</th></tr></thead>
            <tbody>
              {engine.excluded.map((p) => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{cropEmoji(p.crops[0])} {cropName(p.crops[0])} → {cropEmoji(p.crops[1])} {cropName(p.crops[1])}</td>
                  <td className="num">{fmtMoney(p.budget.totalCash, cur)}</td>
                  <td><ReasonList reasons={p.reasons.filter((r) => r.severity === 'block')} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
