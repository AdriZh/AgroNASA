import type { ReactNode } from 'react';
import type { Route } from '../../App';
import { ArrowLeft, ArrowRight, Calculator, CloudSunRain, Coins, Plus, Repeat, RotateCcw, Tags, Target, Tractor, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { Priority } from '../../domain/types';
import { CROPS, cropName } from '../../data/crops';
import { fmtMoney } from '../../domain/units';
import { fmtDate } from '../../domain/dates';
import { CardTitle, Callout, Field, NumInput, Seg, Tag, uid } from '../components/common';

const PRIORITIES: { v: Priority; t: string; d: string; i: ReactNode }[] = [
  { v: 'cost', t: 'Lower upfront cost', i: <Coins size={17} />, d: 'Cheapest feasible plans first; keeps the most cash in hand.' },
  { v: 'climate', t: 'Lower climate exposure', i: <CloudSunRain size={17} />, d: 'Fewest severe-stress seasons in the 25-year NASA replay.' },
  { v: 'continuity', t: 'Continuity', i: <Repeat size={17} />, d: 'Stay close to crops you already grow and know.' },
  { v: 'return', t: 'Higher modeled return', i: <TrendingUp size={17} />, d: 'Highest median modeled net (uses your prices — not a guarantee).' },
];

export function ResourcesPage({ go }: { go: (r: Route) => void }) {
  const { scenario: sc, update, engine } = useApp();
  const pack = engine?.pack;
  const cur = sc.currency;
  const crops = pack?.crops ?? [];
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const setPrice = (k: string, v: number | null | undefined) => update((s) => {
    const o = { ...s.priceOverrides };
    if (v === undefined) delete o[k]; else o[k] = v;
    return { ...s, priceOverrides: o };
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Step 2 of 4</div>
          <h1>Resources & constraints</h1>
          <p>What can you spend, what can you do, and what matters most? Hard constraints are never silently relaxed — if nothing fits, Field Shift says so.</p>
        </div>
        <div className="row"><button className="btn" onClick={() => go('farm')}><ArrowLeft size={16} /> Farm</button><button className="btn primary" onClick={() => go('compare')}>Compare plans <ArrowRight size={16} /></button></div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><CardTitle icon={<Wallet size={17} />}>Budget for the next two seasons</CardTitle><Tag t="farmer" /></div>
          <div className="grid g2">
            <Field label={`Funds available now (${cur})`} hint="Cash you can commit to both seasons."><NumInput value={sc.availableFunds} min={0} onChange={(v) => update((s) => ({ ...s, availableFunds: Math.max(0, v ?? 0) }))} /></Field>
            <Field label={`Reserve to keep (${cur})`} hint="Money you will not spend — for food, health or emergencies."><NumInput value={sc.reserve} min={0} onChange={(v) => update((s) => ({ ...s, reserve: Math.max(0, v ?? 0) }))} /></Field>
            <Field label="Currency"><input className="input" value={sc.currency} onChange={(e) => update((s) => ({ ...s, currency: e.target.value.toUpperCase().slice(0, 4) }))} /></Field>
            <Field label="First planned season (year)"><NumInput value={sc.firstSeasonYear} onChange={(v) => update((s) => ({ ...s, firstSeasonYear: Math.round(v ?? s.firstSeasonYear) }))} /></Field>
          </div>
          <div className="callout ok" style={{ marginTop: 12 }}>
            <Calculator size={18} /><div>Spendable = {fmtMoney(sc.availableFunds, cur)} − {fmtMoney(sc.reserve, cur)} = <b>{fmtMoney(sc.availableFunds - sc.reserve, cur)}</b>. Harvest income and credit are <b>not</b> assumed; season 2 must be fundable without season 1’s harvest unless you add a confirmed inflow.</div>
          </div>
          <h4 style={{ marginTop: 16 }}>Confirmed dated inflows (optional)</h4>
          <p className="mini">Only money that is certain — e.g. an approved subsidy or a signed payment. Each is checked against the due date of every cost.</p>
          {sc.confirmedInflows.map((f) => (
            <div key={f.id} className="row" style={{ marginBottom: 6 }}>
              <input className="input sm" style={{ width: 150 }} type="date" value={f.date} onChange={(e) => update((s) => ({ ...s, confirmedInflows: s.confirmedInflows.map((x) => (x.id === f.id ? { ...x, date: e.target.value } : x)) }))} />
              <div style={{ width: 140 }}><NumInput className="sm" value={f.amount} onChange={(v) => update((s) => ({ ...s, confirmedInflows: s.confirmedInflows.map((x) => (x.id === f.id ? { ...x, amount: v ?? 0 } : x)) }))} /></div>
              <input className="input sm" style={{ flex: 1, minWidth: 120 }} value={f.label} onChange={(e) => update((s) => ({ ...s, confirmedInflows: s.confirmedInflows.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)) }))} />
              <button className="btn ghost danger" onClick={() => update((s) => ({ ...s, confirmedInflows: s.confirmedInflows.filter((x) => x.id !== f.id) }))}><Trash2 size={15} /></button>
            </div>
          ))}
          <button className="btn sm" onClick={() => update((s) => ({ ...s, confirmedInflows: [...s.confirmedInflows, { id: uid(), date: `${s.firstSeasonYear}-06-01`, amount: 0, label: 'Confirmed payment' }] }))}><Plus size={14} /> Add inflow</button>
        </div>

        <div className="card">
          <div className="card-head"><CardTitle icon={<Tractor size={17} />} tone="amber">Practical constraints</CardTitle><Tag t="farmer" /></div>
          <div className="stack">
            <Field label="Irrigation available?">
              <Seg value={sc.irrigation} options={[{ v: 'no', label: 'No' }, { v: 'yes', label: 'Yes' }, { v: 'unknown', label: 'Unknown' }]} onChange={(v) => update((s) => ({ ...s, irrigation: v, irrigationCapacityMm: v === 'yes' && !s.irrigationCapacityMm ? 150 : s.irrigationCapacityMm }))} />
            </Field>
            {sc.irrigation === 'yes' && <Field label="Usable irrigation water per season (mm)" hint="1 mm on 1 ha = 10 m³. The FAO-56 model irrigates when soil water falls below the readily-available level, up to this cap."><NumInput value={sc.irrigationCapacityMm} min={0} onChange={(v) => update((s) => ({ ...s, irrigationCapacityMm: Math.max(0, v ?? 0) }))} /></Field>}
            <Field label="Labor available at peak times">
              <Seg value={sc.laborAvailable} options={[{ v: 'low', label: 'Low' }, { v: 'medium', label: 'Medium' }, { v: 'high', label: 'High' }]} onChange={(v) => update((s) => ({ ...s, laborAvailable: v }))} />
            </Field>
            <label className="check"><input type="checkbox" checked={sc.needsResidue} onChange={(e) => update((s) => ({ ...s, needsResidue: e.target.checked }))} /> I need crop residue for livestock</label>
            <label className="check"><input type="checkbox" checked={sc.allowFallow} onChange={(e) => update((s) => ({ ...s, allowFallow: e.target.checked }))} /> Consider a fallow / rest season</label>
          </div>
          <hr />
          <div className="grid g2">
            <div>
              <h4>Seed I cannot get</h4>
              {crops.filter((c) => c !== 'fallow').map((c) => <div key={c}><label className="check"><input type="checkbox" checked={sc.unavailableCrops.includes(c)} onChange={() => update((s) => ({ ...s, unavailableCrops: toggle(s.unavailableCrops, c) }))} /> {CROPS[c].emoji} {cropName(c)}</label></div>)}
            </div>
            <div>
              <h4>Crops I can sell or use</h4>
              <p className="mini" style={{ margin: 0 }}>Leave all unticked for no restriction.</p>
              {crops.filter((c) => c !== 'fallow').map((c) => <div key={c}><label className="check"><input type="checkbox" checked={sc.marketCrops.includes(c)} onChange={() => update((s) => ({ ...s, marketCrops: toggle(s.marketCrops, c) }))} /> {CROPS[c].emoji} {cropName(c)}</label></div>)}
            </div>
          </div>
        </div>
      </div>

      <div className="card section">
        <CardTitle icon={<Target size={17} />} tone="violet">What matters most this time?</CardTitle>
        <p className="mini">One simple choice. It only orders the feasible options; it never overrides a rule or the budget.</p>
        <div className="grid g4">
          {PRIORITIES.map((p) => (
            <button key={p.v} type="button" className={`choice ${sc.priority === p.v ? 'on' : ''}`} onClick={() => update((s) => ({ ...s, priority: p.v }))}>
              <b><span className={`ic ${sc.priority === p.v ? '' : 'sky'}`} style={{ width: 28, height: 28, flexBasis: 28 }}>{p.i}</span>{p.t}</b><span>{p.d}</span>
            </button>
          ))}
        </div>
        <hr />
        <div className="row">
          <b className="mini">Usual plan (baseline):</b>
          {[0, 1].map((k) => (
            <select key={k} className="input sm" style={{ width: 'auto' }} value={(sc.baselineOverride ?? engine?.baseline.crops ?? ['', ''])[k]} onChange={(e) => update((s) => {
              const b: [string, string] = [...(s.baselineOverride ?? engine?.baseline.crops ?? [crops[0], crops[0]])] as [string, string];
              b[k] = e.target.value; return { ...s, baselineOverride: b };
            })}>
              {crops.map((c) => <option key={c} value={c}>Season {k + 1}: {CROPS[c].emoji} {cropName(c)}</option>)}
            </select>
          ))}
          {sc.baselineOverride ? <button className="btn ghost" onClick={() => update((s) => ({ ...s, baselineOverride: null }))}>Reset to history pattern</button> : <span className="mini">derived from your crop history</span>}
        </div>
      </div>

      {pack && (
        <details className="card section" open>
          <summary><span className="ic amber"><Tags size={17} /></span>Prices & yields — edit to your dated local quotes ({Object.keys(sc.priceOverrides).length} edited)</summary>
          <div style={{ marginTop: 10 }}>
            <Callout tone="warn">Default values in <b>{pack.short}</b> are <b>synthetic placeholders</b> with plausible orders of magnitude. Replace them with local quotes (with date and source) before using results. Clearing a field marks the price <b>missing</b> — the plan then shows “budget not verified”, never zero.</Callout>
            <div className="grid g2" style={{ marginTop: 12 }}>
              {crops.map((c) => {
                const e = pack.economics[c];
                if (!e) return null;
                const yk = `${c}:yield`, pk = `${c}:price`;
                return (
                  <div key={c} className="card flat">
                    <div className="card-head"><h4 style={{ margin: 0 }}>{CROPS[c].emoji} {cropName(c)}</h4>{e.items.some((it) => sc.priceOverrides[`${c}:${it.key}`] === undefined) ? <Tag t="synthetic" /> : <Tag t="farmer">your prices</Tag>}</div>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Item</th><th className="num">Qty/ha</th><th>Unit price ({cur})</th></tr></thead>
                        <tbody>
                          {e.items.map((it) => {
                            const k = `${c}:${it.key}`;
                            const ov = sc.priceOverrides[k];
                            return (
                              <tr key={k}>
                                <td>{it.label}{!it.cash && <span className="chip" style={{ marginLeft: 4 }}>non-cash</span>}</td>
                                <td className="num">{it.qtyPerHa} {it.unit}</td>
                                <td style={{ width: 150 }}>
                                  <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                                    <NumInput className="sm" allowNull value={ov !== undefined ? ov : it.unitPrice} onChange={(v) => setPrice(k, v)} />
                                    {ov !== undefined && <button className="btn ghost" title="Reset to default" onClick={() => setPrice(k, undefined)}><RotateCcw size={14} /></button>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {c !== 'fallow' && <>
                            <tr className="dim"><td>Attainable yield (water-unlimited, your management)</td><td className="num">t/ha</td><td><NumInput className="sm" value={sc.priceOverrides[yk] ?? e.attainableYieldTHa} onChange={(v) => setPrice(yk, v)} /></td></tr>
                            <tr className="dim"><td>Expected farm-gate price</td><td className="num">{cur}/t</td><td><NumInput className="sm" allowNull value={sc.priceOverrides[pk] !== undefined ? sc.priceOverrides[pk] : e.pricePerT} onChange={(v) => setPrice(pk, v)} /></td></tr>
                          </>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mini" style={{ marginTop: 8 }}>Price pack {pack.id} v{pack.version} · last edited {fmtDate(new Date().toISOString().slice(0, 10))} on this device. Yield and sale price are used only for the modeled return range, never for affordability.</p>
          </div>
        </details>
      )}
    </div>
  );
}
