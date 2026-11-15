// Step 2 · Budget & crops: funds and reserve, irrigation, and a menu of allowed crops. Fallow is always considered.
// Prices are computed from data (FAOSTAT + regional templates) and stay hidden unless the farmer opens them.
import { useEffect, useState } from 'react';
import type { Route } from '../../App';
import { ArrowLeft, ArrowRight, Check, Droplets, RotateCcw, Sprout, Tags, X } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { cropName } from '../../data/crops';
import { fmtMoney } from '../../domain/units';
import { CropIcon } from '../components/CropIcon';
import { NumInput, Seg } from '../components/common';

export function ResourcesPage({ go }: { go: (r: Route) => void }) {
  const { scenario: sc, update, engine } = useApp();
  const [pricesOpen, setPricesOpen] = useState(false);
  const cur = sc.currency;
  const crops = (engine?.pack.crops ?? []).filter((c) => c !== 'fallow');
  // one list: a crop is allowed unless excluded (a legacy "crops I can sell" list is honoured until the first edit)
  const allowed = (c: string) => !sc.unavailableCrops.includes(c) && (!sc.marketCrops.length || sc.marketCrops.includes(c));
  const setAllowed = (next: (c: string) => boolean) => update((s) => ({ ...s, unavailableCrops: crops.filter((c) => !next(c)), marketCrops: [] }));
  const toggle = (c: string) => setAllowed((x) => (x === c ? !allowed(c) : allowed(x)));
  const nAllowed = crops.filter(allowed).length;
  const edited = Object.keys(sc.priceOverrides).length;

  return (
    <div className="onboard">
      <div className="onboard-body resources-step">
        <section className="onboard-panel">
          <div>
            <h1>What can you spend?</h1>
            <p className="mini">Cash for both seasons. Harvest income and credit are not assumed.</p>
          </div>
          <div className="grid g2" style={{ gap: 12 }}>
            <label className="field">Money available now, {cur}
              <NumInput value={sc.availableFunds} min={0} onChange={(v) => update((s) => ({ ...s, availableFunds: Math.max(0, v ?? 0) }))} />
            </label>
            <label className="field">Keep in reserve, {cur}
              <NumInput value={sc.reserve} min={0} onChange={(v) => update((s) => ({ ...s, reserve: Math.max(0, v ?? 0) }))} />
            </label>
          </div>
          <MoneySplit funds={sc.availableFunds} reserve={sc.reserve} cur={cur} />

          <div className="divider" />
          <div>
            <h2 className="h-sub"><Droplets size={16} aria-hidden /> Can you irrigate?</h2>
            <Seg label="Irrigation" value={sc.irrigation} options={[{ v: 'no', label: 'No' }, { v: 'yes', label: 'Yes' }, { v: 'unknown', label: 'Not sure' }]} onChange={(v) => update((s) => ({ ...s, irrigation: v, irrigationCapacityMm: v === 'yes' && !s.irrigationCapacityMm ? 150 : s.irrigationCapacityMm }))} />
            {sc.irrigation === 'yes' && (
              <label className="field" style={{ marginTop: 12, maxWidth: 260 }}>Water you can apply per season, mm
                <NumInput value={sc.irrigationCapacityMm} min={0} onChange={(v) => update((s) => ({ ...s, irrigationCapacityMm: Math.max(0, v ?? 0) }))} />
                <span className="mini" style={{ fontWeight: 400 }}>1 mm on 1 ha = 10 m³ of water.</span>
              </label>
            )}
          </div>
          <FieldScene irrigated={sc.irrigation === 'yes'} crops={crops.filter(allowed)} />
        </section>

        <section className="onboard-panel">
          <div>
            <h1>Which crops can you grow?</h1>
            <p className="mini">All allowed to start. Tap a crop to leave it out.</p>
          </div>
          <div className="crop-chips" role="group" aria-label="Allowed crops">
            {crops.map((c) => (
              <button key={c} type="button" className={`crop-chip ${allowed(c) ? 'on' : ''}`} aria-pressed={allowed(c)} onClick={() => toggle(c)}>
                <CropIcon id={c} size={64} /><span>{cropName(c)}</span><Check className="tick" size={16} aria-hidden />
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="mini">{nAllowed} of {crops.length} allowed</span>
            {nAllowed < crops.length && <button type="button" className="linkish mini" onClick={() => setAllowed(() => true)}>Allow all</button>}
          </div>
          {nAllowed === 0 && <p className="mini warn-t">Allow at least one crop, or only rest seasons can be planned.</p>}
        </section>
      </div>

      <div className="onboard-foot">
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={() => go('farm')}><ArrowLeft /> Your field</button>
          <button type="button" className="btn ghost sm" onClick={() => setPricesOpen(true)} title="Prices and costs are computed from data (FAOSTAT + regional template)"><Tags size={14} /> Prices{edited ? ` (${edited} edited)` : ''}</button>
        </div>
        <button type="button" className="btn primary" onClick={() => go('compare')}>Compare plans <ArrowRight /></button>
      </div>

      {pricesOpen && <PricesDialog onClose={() => setPricesOpen(false)} />}
    </div>
  );
}

/** The full price & yield editor, only on request. Clearing a value marks it missing ("budget not verified"), never zero. */
function PricesDialog({ onClose }: { onClose: () => void }) {
  const { scenario: sc, update, engine } = useApp();
  const pack = engine?.pack;
  const cur = sc.currency;
  const priceCrops = (pack?.crops ?? []).filter((c) => pack?.economics[c]);
  const [crop, setCrop] = useState<string | null>(null);
  const active = crop && priceCrops.includes(crop) ? crop : priceCrops[0];
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  const setPrice = (k: string, v: number | null | undefined) => update((s) => {
    const o = { ...s.priceOverrides };
    if (v === undefined) delete o[k]; else o[k] = v;
    return { ...s, priceOverrides: o };
  });
  if (!pack || !active) return null;
  const e = pack.economics[active];
  const yk = `${active}:yield`, pk = `${active}:price`;
  const reset = (k: string) => sc.priceOverrides[k] !== undefined && <button className="btn ghost plain icon sm" aria-label="Back to the computed value" title="Back to the computed value" onClick={() => setPrice(k, undefined)}><RotateCcw /></button>;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="prices-title" onClick={(ev) => ev.stopPropagation()}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <h2 id="prices-title" className="h-sub" style={{ margin: 0 }}><Tags size={16} /> Adjust prices</h2>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <p className="mini">Computed values are shown; type your local price to replace one, or use <RotateCcw size={12} /> to go back. Clearing a field marks it missing (“budget not verified”), never zero.</p>
        <div style={{ margin: '12px 0' }}>
          <Seg label="Crop" value={active} options={priceCrops.map((c) => ({ v: c, label: <span className="crop-name"><CropIcon id={c} size={16} />{cropName(c)}</span> }))} onChange={setCrop} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th className="num">Qty/ha</th><th>Unit</th><th className="num">Price, {cur}</th></tr></thead>
            <tbody>
              {active !== 'fallow' && <>
                <tr><td className="wrap"><b>Sale price</b><div className="mini">{engine?.prices[active]?.label}</div></td><td /><td className="nowrap">{cur}/t</td><td className="num"><div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>{reset(pk)}<div style={{ width: 120 }}><NumInput className="sm" label="Sale price" allowNull value={sc.priceOverrides[pk] !== undefined ? sc.priceOverrides[pk] : engine?.prices[active]?.perT ?? null} onChange={(v) => setPrice(pk, v)} /></div></div></td></tr>
                <tr><td className="wrap"><b>Yield you can reach</b><div className="mini">good-rain year, your management</div></td><td /><td>t/ha</td><td className="num"><div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>{reset(yk)}<div style={{ width: 120 }}><NumInput className="sm" label="Attainable yield" value={sc.priceOverrides[yk] ?? e.attainableYieldTHa} onChange={(v) => setPrice(yk, v)} /></div></div></td></tr>
              </>}
              {e.items.map((it) => {
                const k = `${active}:${it.key}`;
                const ov = sc.priceOverrides[k];
                return (
                  <tr key={k}>
                    <td className="wrap">{it.label}{!it.cash && !/non-cash/i.test(it.label) && <span className="muted"> · family labour (not cash)</span>}</td>
                    <td className="num">{it.qtyPerHa}</td>
                    <td className="nowrap">{it.unit}</td>
                    <td className="num"><div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>{reset(k)}<div style={{ width: 120 }}><NumInput className="sm" label={`${it.label} unit price`} allowNull value={ov !== undefined ? ov : it.unitPrice == null ? null : Math.round(it.unitPrice * (engine?.fx.factor ?? 1) * 100) / 100} onChange={(v) => setPrice(k, v)} /></div></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="spread" style={{ marginTop: 12 }}>
          <label className="mini row" style={{ gap: 6 }}>Currency <input className="input sm" style={{ width: 80 }} value={sc.currency} onChange={(ev) => update((s) => ({ ...s, currency: ev.target.value.toUpperCase().slice(0, 4) }))} /></label>
          <button className="btn primary sm" onClick={onClose}><Sprout size={14} /> Done</button>
        </div>
      </div>
    </div>
  );
}

/** Money as a picture: what you can spend next to what you keep. */
function MoneySplit({ funds, reserve, cur }: { funds: number; reserve: number; cur: string }) {
  const spend = Math.max(0, funds - reserve);
  const share = funds > 0 ? Math.min(100, (100 * spend) / funds) : 0;
  return (
    <div className="money-split" aria-label={`${fmtMoney(spend, cur)} to spend`}>
      <div className="ms-bar">
        <i className="ms-spend" style={{ width: `${share}%` }} />
        <i className="ms-keep" style={{ width: `${100 - share}%` }} />
      </div>
      <div className="ms-legend"><span><b>{fmtMoney(spend, cur)}</b> to spend</span><span className="muted">{fmtMoney(Math.min(reserve, funds), cur)} kept</span></div>
    </div>
  );
}

/** Decorative field: rows planted with the allowed crops, with falling drops when you can irrigate. */
function FieldScene({ irrigated, crops }: { irrigated: boolean; crops: string[] }) {
  const list = crops.length ? crops : ['fallow'];
  return (
    <div className={`field-scene ${irrigated ? 'wet' : ''}`} aria-hidden>
      {irrigated && <div className="fs-rain">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 7.3 + 3) % 100}%`, animationDelay: `${(i * 0.37) % 1.6}s` }} />)}</div>}
      {Array.from({ length: 4 }, (_, r) => (
        <div key={r} className="fs-row">
          {Array.from({ length: 9 }, (_, k) => <CropIcon key={k} id={list[(r + Math.floor(k / 3)) % list.length]} size={22} />)}
        </div>
      ))}
    </div>
  );
}
