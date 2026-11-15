import { useState } from 'react';
import { CropIcon } from '../components/CropIcon';
import type { Route } from '../../App';
import { ArrowLeft, ArrowRight, Plus, RotateCcw, Tags, Target, Tractor, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { PrioritySliders } from '../components/PrioritySliders';
import { CROPS, cropName } from '../../data/crops';
import { fmtMoney } from '../../domain/units';
import { fmtDate } from '../../domain/dates';
import { CardTitle, Disclaimer, Field, Money, NumInput, Seg, Stat, Tag, uid } from '../components/common';


export function ResourcesPage({ go }: { go: (r: Route) => void }) {
  const { scenario: sc, update, engine } = useApp();
  const pack = engine?.pack;
  const cur = sc.currency;
  const crops = pack?.crops ?? [];
  const [crop, setCrop] = useState<string | null>(null);
  const priceCrops = crops.filter((c) => pack?.economics[c]);
  const active = crop && priceCrops.includes(crop) ? crop : priceCrops[0];
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const setPrice = (k: string, v: number | null | undefined) => update((s) => {
    const o = { ...s.priceOverrides };
    if (v === undefined) delete o[k]; else o[k] = v;
    return { ...s, priceOverrides: o };
  });
  const sellable = crops.filter((c) => c !== 'fallow');

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="caption">Step 2 of 4</span>
          <h1>Resources and constraints</h1>
          <p>What can you spend, what can you do, and what matters most? Hard constraints are never silently relaxed: if nothing fits, Field Shift says so.</p>
        </div>
        <div className="page-actions"><button className="btn" onClick={() => go('farm')}><ArrowLeft /> Farm</button><button className="btn primary" onClick={() => go('compare')}>Compare plans <ArrowRight /></button></div>
      </div>

      <div className="grid g2">
        <section className="card">
          <div className="card-head"><CardTitle icon={<Wallet />}>Budget</CardTitle><Tag t="farmer" /></div>
          <div className="grid g2">
            <Field label={`Funds available now, ${cur}`} hint="Cash you can commit to both seasons."><NumInput value={sc.availableFunds} min={0} onChange={(v) => update((s) => ({ ...s, availableFunds: Math.max(0, v ?? 0) }))} /></Field>
            <Field label={`Reserve to keep, ${cur}`} hint="Money you will not spend: food, health, emergencies."><NumInput value={sc.reserve} min={0} onChange={(v) => update((s) => ({ ...s, reserve: Math.max(0, v ?? 0) }))} /></Field>
            <Field label="Currency"><input className="input" value={sc.currency} onChange={(e) => update((s) => ({ ...s, currency: e.target.value.toUpperCase().slice(0, 4) }))} /></Field>
            <Field label="First planned season (year)"><NumInput value={sc.firstSeasonYear} onChange={(v) => update((s) => ({ ...s, firstSeasonYear: Math.round(v ?? s.firstSeasonYear) }))} /></Field>
          </div>
          <div className="group">
            <Stat label="Spendable" value={<Money v={sc.availableFunds - sc.reserve} cur={cur} />} sub={<>{fmtMoney(sc.availableFunds, cur)} funds − {fmtMoney(sc.reserve, cur)} reserve. Harvest income and credit are not assumed; season 2 must be fundable without season 1’s harvest unless you add a confirmed inflow.</>} />
          </div>
          <div className="group">
            <h4>Confirmed dated inflows <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></h4>
            <p className="mini" style={{ marginBottom: 8 }}>Only money that is certain, such as an approved subsidy or a signed payment. Each is checked against the due date of every cost.</p>
            {sc.confirmedInflows.map((f) => (
              <div key={f.id} className="row" style={{ marginBottom: 8 }}>
                <input className="input sm" style={{ width: 150 }} type="date" aria-label="Inflow date" value={f.date} onChange={(e) => update((s) => ({ ...s, confirmedInflows: s.confirmedInflows.map((x) => (x.id === f.id ? { ...x, date: e.target.value } : x)) }))} />
                <div style={{ width: 140 }}><NumInput className="sm" label="Amount" value={f.amount} onChange={(v) => update((s) => ({ ...s, confirmedInflows: s.confirmedInflows.map((x) => (x.id === f.id ? { ...x, amount: v ?? 0 } : x)) }))} /></div>
                <input className="input sm" style={{ flex: 1, minWidth: 120 }} aria-label="Inflow label" value={f.label} onChange={(e) => update((s) => ({ ...s, confirmedInflows: s.confirmedInflows.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)) }))} />
                <button className="btn ghost danger icon sm" aria-label="Remove inflow" onClick={() => update((s) => ({ ...s, confirmedInflows: s.confirmedInflows.filter((x) => x.id !== f.id) }))}><Trash2 /></button>
              </div>
            ))}
            <button className="btn sm" onClick={() => update((s) => ({ ...s, confirmedInflows: [...s.confirmedInflows, { id: uid(), date: `${s.firstSeasonYear}-06-01`, amount: 0, label: 'Confirmed payment' }] }))}><Plus /> Add inflow</button>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><CardTitle icon={<Tractor />}>Constraints</CardTitle><Tag t="farmer" /></div>
          <div className="stack">
            <Field label="Irrigation available?">
              <Seg label="Irrigation" value={sc.irrigation} options={[{ v: 'no', label: 'No' }, { v: 'yes', label: 'Yes' }, { v: 'unknown', label: 'Unknown' }]} onChange={(v) => update((s) => ({ ...s, irrigation: v, irrigationCapacityMm: v === 'yes' && !s.irrigationCapacityMm ? 150 : s.irrigationCapacityMm }))} />
            </Field>
            {sc.irrigation === 'yes' && <Field label="Usable irrigation water per season (mm)" hint="1 mm on 1 ha = 10 m³. The FAO-56 model irrigates when soil water falls below the readily-available level, up to this cap."><NumInput value={sc.irrigationCapacityMm} min={0} onChange={(v) => update((s) => ({ ...s, irrigationCapacityMm: Math.max(0, v ?? 0) }))} /></Field>}
            <div className="stack-sm" style={{ gap: 0 }}>
              <label className="check"><input type="checkbox" checked={sc.needsResidue} onChange={(e) => update((s) => ({ ...s, needsResidue: e.target.checked }))} /> I need crop residue for livestock</label>
              <label className="check"><input type="checkbox" checked={sc.allowFallow} onChange={(e) => update((s) => ({ ...s, allowFallow: e.target.checked }))} /> Consider a fallow or rest season</label>
            </div>
          </div>
          <div className="grid g2 group">
            <div>
              <h4>Seed I cannot get</h4>
              {sellable.map((c) => <div key={c}><label className="check"><input type="checkbox" checked={sc.unavailableCrops.includes(c)} onChange={() => update((s) => ({ ...s, unavailableCrops: toggle(s.unavailableCrops, c) }))} /> <CropIcon id={c} size={18} /> {cropName(c)}</label></div>)}
            </div>
            <div>
              <h4>Crops I can sell or use</h4>
              <p className="mini">Leave all unticked for no restriction.</p>
              {sellable.map((c) => <div key={c}><label className="check"><input type="checkbox" checked={sc.marketCrops.includes(c)} onChange={() => update((s) => ({ ...s, marketCrops: toggle(s.marketCrops, c) }))} /> <CropIcon id={c} size={18} /> {cropName(c)}</label></div>)}
            </div>
          </div>
        </section>
      </div>

      <section className="card section">
        <div className="card-head"><div><CardTitle icon={<Target />}>What matters to you this time?</CardTitle><p className="mini">Set how much each goal matters. The options are ranked by the weighted mix; it only orders feasible plans and never overrides a rule or the budget.</p></div></div>
        <PrioritySliders />
        <div className="row group">
          <h4>Usual plan (baseline):</h4>
          {[0, 1].map((k) => (
            <select key={k} className="input sm" style={{ width: 'auto' }} aria-label={`Usual plan season ${k + 1}`} value={(sc.baselineOverride ?? engine?.baseline.crops ?? ['', ''])[k]} onChange={(e) => update((s) => {
              const b: [string, string] = [...(s.baselineOverride ?? engine?.baseline.crops ?? [crops[0], crops[0]])] as [string, string];
              b[k] = e.target.value; return { ...s, baselineOverride: b };
            })}>
              {crops.map((c) => <option key={c} value={c}>Season {k + 1}: {CROPS[c].emoji} {cropName(c)}</option>)}
            </select>
          ))}
          {sc.baselineOverride ? <button className="btn ghost sm" onClick={() => update((s) => ({ ...s, baselineOverride: null }))}>Reset to history pattern</button> : <span className="mini">derived from your crop history</span>}
        </div>
      </section>

      {pack && active && (() => {
        const e = pack.economics[active];
        const yk = `${active}:yield`, pk = `${active}:price`;
        const allYours = e.items.every((it) => sc.priceOverrides[`${active}:${it.key}`] !== undefined);
        return (
          <section className="card section">
            <div className="card-head">
              <div><CardTitle icon={<Tags />}>Prices and yields</CardTitle><p className="mini">Edit to your dated local quotes. {Object.keys(sc.priceOverrides).length} edited.</p></div>
              {allYours ? <Tag t="farmer">your prices</Tag> : <Tag t="synthetic" />}
            </div>
            <Disclaimer details={[
              <>Crop sale prices come from FAOSTAT producer prices for your country (or the global median when FAOSTAT has none), converted at the FAOSTAT exchange rate.</>,
              <>Input costs are a synthetic regional template{engine && engine.fx.factor !== 1 ? ` converted ${engine.fx.from}→${engine.fx.to}` : ''}; replace them with dated local quotes before using results.</>,
              <>Clearing a field marks the price missing: the plan then shows “Budget not verified”, never zero.</>,
            ]}>Input costs are synthetic demo prices; sale prices come from FAOSTAT.</Disclaimer>
            <div style={{ margin: '16px 0' }}>
              <Seg label="Crop" value={active} options={priceCrops.map((c) => ({ v: c, label: <span className="crop-name"><CropIcon id={c} size={16} />{cropName(c)}</span> }))} onChange={setCrop} />
            </div>
            <div className="table-wrap sticky-first">
              <table>
                <thead><tr><th>Item</th><th className="num">Qty/ha</th><th>Unit</th><th className="num">Unit price, {cur}</th></tr></thead>
                <tbody>
                  {e.items.map((it) => {
                    const k = `${active}:${it.key}`;
                    const ov = sc.priceOverrides[k];
                    return (
                      <tr key={k}>
                        <td className="wrap">{it.label}{!it.cash && !/non-cash/i.test(it.label) && <span className="muted"> · non-cash</span>}</td>
                        <td className="num">{it.qtyPerHa}</td>
                        <td className="nowrap">{it.unit}</td>
                        <td className="num">
                          <div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                            {ov !== undefined && <button className="btn ghost plain icon sm" aria-label="Reset to default" title="Reset to default" onClick={() => setPrice(k, undefined)}><RotateCcw /></button>}
                            <div style={{ width: 120 }}><NumInput className="sm" label={`${it.label} unit price`} allowNull value={ov !== undefined ? ov : it.unitPrice == null ? null : Math.round(it.unitPrice * (engine?.fx.factor ?? 1) * 100) / 100} onChange={(v) => setPrice(k, v)} /></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {active !== 'fallow' && <>
                    <tr className="total"><td className="wrap">Attainable yield <span className="muted" style={{ fontWeight: 400 }}>(water-unlimited, your management)</span></td><td className="num" /><td>t/ha</td><td className="num"><div style={{ width: 120, marginLeft: 'auto' }}><NumInput className="sm" label="Attainable yield" value={sc.priceOverrides[yk] ?? e.attainableYieldTHa} onChange={(v) => setPrice(yk, v)} /></div></td></tr>
                    <tr><td className="wrap">Expected farm-gate price<div className="mini">{engine?.prices[active]?.label}</div></td><td className="num" /><td className="nowrap">{cur}/t</td><td className="num"><div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>{sc.priceOverrides[pk] !== undefined && <button className="btn ghost plain icon sm" aria-label="Back to FAOSTAT price" title="Back to FAOSTAT price" onClick={() => setPrice(pk, undefined)}><RotateCcw /></button>}<div style={{ width: 120 }}><NumInput className="sm" label="Farm-gate price" allowNull value={sc.priceOverrides[pk] !== undefined ? sc.priceOverrides[pk] : engine?.prices[active]?.perT ?? null} onChange={(v) => setPrice(pk, v)} /></div></div></td></tr>
                  </>}
                </tbody>
              </table>
            </div>
            <p className="chart-cap">Price pack {pack.id} v{pack.version} · last edited {fmtDate(new Date().toISOString().slice(0, 10))} on this device. Yield and sale price are used only for the modeled return range, never for affordability.</p>
          </section>
        );
      })()}
    </div>
  );
}
