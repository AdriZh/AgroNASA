import { useState } from 'react';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import type { CropSeason, FertilizerApplication, SoilTexture } from '../../domain/types';
import { CROPS, cropName } from '../../data/crops';
import { FERTILIZERS, fertById } from '../../data/fertilizers';
import { detectPack, PACKS } from '../../data/regionPacks';
import { geocode, type GeoHit } from '../../weather/forecast';
import { normalizeApplication, fmtNum } from '../../domain/units';
import { TEXTURE_LABEL } from '../../soil/soil';
import { MapView } from '../components/MapView';
import { Callout, Field, NumInput, Tag, uid } from '../components/common';
import { powerGridCell } from '../../weather/power';

export function FarmPage({ go }: { go: (r: Route) => void }) {
  const { scenario: sc, update, engine, data, soil } = useApp();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const pack = engine?.pack ?? detectPack(sc.location.lat, sc.location.lon);
  const crops = [...new Set([...pack.crops, ...sc.history.map((h) => h.cropId)])].filter((c) => CROPS[c]);

  const setLocation = (lat: number, lon: number, label?: string) => update((s) => {
    const p = detectPack(lat, lon);
    const switched = (packOf(s) !== p.id);
    return { ...s, location: { lat, lon, label: label ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}` }, regionPackId: undefined, ...(switched ? { currency: p.currency, priceOverrides: {} } : {}) };
  });
  const packOf = (s: typeof sc) => s.regionPackId ?? detectPack(s.location.lat, s.location.lon).id;

  const search = async () => {
    setGeoErr(null);
    try { const r = await geocode(q); setHits(r); if (!r.length) setGeoErr('No place found.'); } catch (e: any) { setGeoErr(`Search unavailable (${e.message}). Click the map or type coordinates instead.`); }
  };
  const myLocation = () => navigator.geolocation?.getCurrentPosition((p) => setLocation(Number(p.coords.latitude.toFixed(4)), Number(p.coords.longitude.toFixed(4)), 'My location'), () => setGeoErr('Location permission denied.'));

  const setH = (id: string, patch: Partial<CropSeason>) => update((s) => ({ ...s, history: s.history.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  const addH = () => update((s) => {
    const last = [...s.history].sort((a, b) => a.year - b.year).slice(-1)[0];
    return { ...s, history: [...s.history, { id: uid(), cropId: pack.crops[0], year: last ? last.year + 1 : s.firstSeasonYear - 1, approximateDate: true, outcome: 'unknown' }] };
  });
  const delH = (id: string) => update((s) => ({ ...s, history: s.history.filter((h) => h.id !== id), fertilizer: s.fertilizer.filter((f) => f.cropSeasonId !== id) }));

  const setF = (id: string, patch: Partial<FertilizerApplication>) => update((s) => ({ ...s, fertilizer: s.fertilizer.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const addF = () => update((s) => {
    const h = [...s.history].sort((a, b) => b.year - a.year)[0];
    if (!h) return s;
    const p = FERTILIZERS[1];
    return { ...s, fertilizer: [...s.fertilizer, { id: uid(), cropSeasonId: h.id, productId: p.id, productName: p.name, type: p.type, approximateDate: true, quantity: null, quantityUnit: 'bag', bagMassKg: p.bagKg, treatedAreaHa: null, n: p.n, p2o5: p.p2o5, k2o: p.k2o, source: 'recall' }] };
  });
  const delF = (id: string) => update((s) => ({ ...s, fertilizer: s.fertilizer.filter((f) => f.id !== id) }));
  const histSorted = [...sc.history].sort((a, b) => a.year - b.year);
  const cell = powerGridCell(sc.location.lat, sc.location.lon);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Step 1 of 4</div>
          <h1>Farm & history</h1>
          <p>Where is the field, what grew there and what was applied? Unknown values are allowed — they stay “unknown” and are never silently turned into zero.</p>
        </div>
        <button className="btn primary" onClick={() => go('resources')}>Next: Resources →</button>
      </div>

      <div className="grid g-side">
        <div className="card">
          <div className="card-head"><h3>📍 Field location</h3><Tag t="farmer" /></div>
          <div className="row" style={{ marginBottom: 10 }}>
            <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Search a village, district or region…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
            <button className="btn" onClick={search}>Search</button>
            <button className="btn" onClick={myLocation} title="Use device GPS">◎ GPS</button>
          </div>
          {geoErr && <p className="mini" style={{ color: 'var(--amber)' }}>{geoErr}</p>}
          {hits.length > 0 && (
            <div className="stack" style={{ marginBottom: 10 }}>
              {hits.map((h) => <button key={h.label} className="btn sm" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => { setLocation(Number(h.lat.toFixed(4)), Number(h.lon.toFixed(4)), h.label.split(',').slice(0, 3).join(',')); setHits([]); }}>📍 {h.label}</button>)}
            </div>
          )}
          <MapView lat={sc.location.lat} lon={sc.location.lon} onPick={(a, b) => setLocation(a, b)} defaultLayer="none" />
          <p className="mini" style={{ marginTop: 6 }}>Click the map to move the field. Only these coordinates are sent to NASA POWER / SoilGrids — never your history or budget.</p>
        </div>

        <div className="stack">
          <div className="card">
            <h3>🌾 Field basics</h3>
            <div className="grid g2">
              <Field label="Latitude"><NumInput value={sc.location.lat} onChange={(v) => v != null && setLocation(v, sc.location.lon)} /></Field>
              <Field label="Longitude"><NumInput value={sc.location.lon} onChange={(v) => v != null && setLocation(sc.location.lat, v)} /></Field>
              <Field label="Field area" hint="Point + area is enough; no boundary drawing needed."><NumInput value={sc.area} min={0} onChange={(v) => update((s) => ({ ...s, area: Math.max(0.01, v ?? 0.01) }))} /></Field>
              <Field label="Area unit">
                <select className="input" value={sc.areaUnit} onChange={(e) => update((s) => ({ ...s, areaUnit: e.target.value as any }))}>
                  <option value="ha">hectares</option><option value="acre">acres</option><option value="m2">square metres</option>
                </select>
              </Field>
              <Field label="Scenario name"><input className="input" value={sc.name} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} /></Field>
              <Field label="Place label"><input className="input" value={sc.location.label ?? ''} onChange={(e) => update((s) => ({ ...s, location: { ...s.location, label: e.target.value } }))} /></Field>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>📘 Regional knowledge pack</h3><Tag t="rule" /></div>
            <select className="input" value={sc.regionPackId ?? ''} onChange={(e) => update((s) => ({ ...s, regionPackId: e.target.value || undefined, currency: (PACKS.find((p) => p.id === e.target.value) ?? detectPack(s.location.lat, s.location.lon)).currency, priceOverrides: {} }))}>
              <option value="">Auto-detect from location ({detectPack(sc.location.lat, sc.location.lon).short})</option>
              {PACKS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="mini" style={{ marginTop: 8 }}>{pack.description}</p>
            {pack.id === 'global-screening' && <Callout tone="warn">No reviewed local pack covers this location. Field Shift will screen a generic crop library against the NASA climate record and apply only generic rotation principles. Treat results as a demonstration.</Callout>}
            <div className="mini">NASA POWER grid cell centre: {cell.cLat.toFixed(2)}°, {cell.cLon.toFixed(3)}° · {data.series ? `elevation ${Math.round(data.series.meta.elevation)} m` : ''}</div>
          </div>
        </div>
      </div>

      <div className="card section">
        <div className="card-head">
          <div><h3>🗓️ Crop history (last 1–3 seasons)</h3><p className="mini" style={{ margin: 0 }}>Dates drive the past-season review. If you only remember the month, tick “approx.”. Leave dates empty to let NASA rain-onset/temperature rules estimate them.</p></div>
          <div className="row"><Tag t="farmer" /><button className="btn sm" onClick={addH}>＋ Add season</button></div>
        </div>
        {histSorted.length === 0 ? <div className="empty">No history yet. Field Shift still works — the usual plan will default to the first crop in the pack.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Year</th><th>Crop</th><th>Planted</th><th>Harvested</th><th>Approx.</th><th>Outcome</th><th>Yield t/ha</th><th>Residue</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {histSorted.map((h) => (
                  <tr key={h.id}>
                    <td style={{ minWidth: 90 }}><NumInput className="sm" value={h.year} onChange={(v) => setH(h.id, { year: Math.round(v ?? h.year) })} /></td>
                    <td><select className="input sm" style={{ minWidth: 150 }} value={h.cropId} onChange={(e) => setH(h.id, { cropId: e.target.value })}>{[...new Set([...crops, ...Object.keys(CROPS)])].map((c) => <option key={c} value={c}>{CROPS[c].emoji} {cropName(c)}</option>)}</select></td>
                    <td><input className="input sm" type="date" value={h.plantedOn ?? ''} onChange={(e) => setH(h.id, { plantedOn: e.target.value || undefined })} /></td>
                    <td><input className="input sm" type="date" value={h.harvestedOn ?? ''} onChange={(e) => setH(h.id, { harvestedOn: e.target.value || undefined })} /></td>
                    <td><input type="checkbox" checked={h.approximateDate} onChange={(e) => setH(h.id, { approximateDate: e.target.checked })} aria-label="approximate dates" /></td>
                    <td><select className="input sm" style={{ minWidth: 100 }} value={h.outcome ?? 'unknown'} onChange={(e) => setH(h.id, { outcome: e.target.value as any })}>{['good', 'average', 'poor', 'failed', 'unknown'].map((o) => <option key={o}>{o}</option>)}</select></td>
                    <td style={{ width: 90 }}><NumInput className="sm" allowNull value={h.yieldTHa ?? null} onChange={(v) => setH(h.id, { yieldTHa: v })} /></td>
                    <td><select className="input sm" style={{ minWidth: 100 }} value={h.residueUse ?? 'unknown'} onChange={(e) => setH(h.id, { residueUse: e.target.value as any })}>{['left', 'grazed', 'removed', 'burned', 'unknown'].map((o) => <option key={o}>{o}</option>)}</select></td>
                    <td><input className="input sm" value={h.notes ?? ''} onChange={(e) => setH(h.id, { notes: e.target.value })} /></td>
                    <td><button className="btn ghost danger" onClick={() => delH(h.id)} aria-label="Delete season">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="card section" open={sc.fertilizer.length > 0}>
        <summary>🧪 Fertilizer & manure applications ({sc.fertilizer.length}) — optional, detailed record</summary>
        <div style={{ marginTop: 12 }}>
          <Callout tone="info">Records are historical context. Field Shift converts them to product rate and label nutrients (N, P₂O₅, K₂O) only when units and treated area are known. It never infers present soil N–P–K from purchases and never charges past purchases to a new plan.</Callout>
          <div className="row" style={{ justifyContent: 'flex-end', margin: '10px 0' }}><button className="btn sm" onClick={addF} disabled={!sc.history.length}>＋ Add application</button></div>
          {sc.fertilizer.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Season</th><th>Product</th><th>Date</th><th>Qty</th><th>Unit</th><th>Bag kg</th><th>Treated ha</th><th>N–P₂O₅–K₂O %</th><th>Paid</th><th className="num">Rate kg/ha</th><th className="num">N kg/ha</th><th>Flags</th><th /></tr></thead>
                <tbody>
                  {sc.fertilizer.map((f) => {
                    const nm = normalizeApplication(f);
                    return (
                      <tr key={f.id}>
                        <td><select className="input sm" style={{ minWidth: 140 }} value={f.cropSeasonId} onChange={(e) => setF(f.id, { cropSeasonId: e.target.value })}>{histSorted.map((h) => <option key={h.id} value={h.id}>{h.year} {cropName(h.cropId)}</option>)}</select></td>
                        <td><select className="input sm" style={{ minWidth: 170 }} value={f.productId} onChange={(e) => { const p = fertById(e.target.value)!; setF(f.id, { productId: p.id, productName: p.name, type: p.type, n: p.n, p2o5: p.p2o5, k2o: p.k2o, bagMassKg: f.bagMassKg ?? p.bagKg }); }}>{FERTILIZERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                        <td><input className="input sm" style={{ minWidth: 140 }} type="date" value={f.applicationDate ?? ''} onChange={(e) => setF(f.id, { applicationDate: e.target.value || undefined })} /></td>
                        <td style={{ width: 80 }}><NumInput className="sm" allowNull value={f.quantity} onChange={(v) => setF(f.id, { quantity: v })} /></td>
                        <td><select className="input sm" style={{ minWidth: 64 }} value={f.quantityUnit} onChange={(e) => setF(f.id, { quantityUnit: e.target.value as any })}>{['kg', 'bag', 't', 'L'].map((u) => <option key={u}>{u}</option>)}</select></td>
                        <td style={{ width: 70 }}><NumInput className="sm" allowNull value={f.bagMassKg ?? null} onChange={(v) => setF(f.id, { bagMassKg: v })} /></td>
                        <td style={{ width: 80 }}><NumInput className="sm" allowNull value={f.treatedAreaHa ?? null} onChange={(v) => setF(f.id, { treatedAreaHa: v })} /></td>
                        <td style={{ minWidth: 150 }}><div className="row" style={{ gap: 3, flexWrap: 'nowrap' }}>{(['n', 'p2o5', 'k2o'] as const).map((k) => <NumInput key={k} className="sm" allowNull value={f[k] ?? null} onChange={(v) => setF(f.id, { [k]: v } as any)} />)}</div></td>
                        <td style={{ width: 100 }}><NumInput className="sm" allowNull value={f.paidCost ?? null} onChange={(v) => setF(f.id, { paidCost: v })} /></td>
                        <td className="num">{fmtNum(nm.rateKgHa, 0)}</td>
                        <td className="num">{fmtNum(nm.nKgHa, 1)}</td>
                        <td className="mini" style={{ minWidth: 200, maxWidth: 260 }}>{nm.flags.join('; ') || '—'}</td>
                        <td><button className="btn ghost danger" onClick={() => delF(f.id)} aria-label="Delete application">✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      <div className="grid g2 section">
        <div className="card">
          <div className="card-head"><h3>🟤 Soil you know</h3><Tag t="farmer" /></div>
          <div className="grid g2">
            <Field label="Texture (feel / local name)" hint="Overrides the SoilGrids estimate for the water-balance model.">
              <select className="input" value={sc.soil.texture} onChange={(e) => update((s) => ({ ...s, soil: { ...s.soil, texture: e.target.value as SoilTexture } }))}>
                {Object.entries(TEXTURE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Lab pH (optional)" hint="From a recent soil test, if any."><NumInput allowNull value={sc.soil.labPh ?? null} onChange={(v) => update((s) => ({ ...s, soil: { ...s.soil, labPh: v } }))} /></Field>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>🗺️ Soil map at this point</h3><Tag t="soilgrids" /></div>
          {data.soilGrid ? (
            <div className="table-wrap"><table><tbody>
              <tr><td>Texture (0–60 cm)</td><td><b>{TEXTURE_LABEL[data.soilGrid.texture]}</b> · sand {fmtNum(data.soilGrid.sandPct, 0)}% · clay {fmtNum(data.soilGrid.clayPct, 0)}%</td></tr>
              <tr><td>Organic carbon</td><td>{fmtNum(data.soilGrid.socPct, 2)} %</td></tr>
              <tr><td>pH (H₂O)</td><td>{fmtNum(data.soilGrid.ph, 1)}</td></tr>
              <tr><td>Total N</td><td>{fmtNum(data.soilGrid.nitrogenGKg, 2)} g/kg</td></tr>
              <tr><td>CEC</td><td>{fmtNum(data.soilGrid.cec, 1)} cmol(c)/kg</td></tr>
              <tr><td>Water-balance AWC used</td><td><b>{fmtNum(soil?.awcMmPerM, 0)} mm/m</b> <Tag t={soil?.source === 'farmer' ? 'farmer' : 'modeled'}>{soil?.source === 'farmer' ? 'from your texture' : 'Saxton & Rawls'}</Tag></td></tr>
            </tbody></table></div>
          ) : <p className="mini">{data.soilStatus === 'loading' ? 'Loading SoilGrids…' : `SoilGrids unavailable${data.soilError ? ` (${data.soilError})` : ''}. Using ${soil?.source === 'farmer' ? 'your texture' : 'a default loam (140 mm/m)'}.`}</p>}
          <p className="mini" style={{ marginTop: 8 }}>A 250 m modeled map, not a soil test. Present nutrient status remains unknown unless measured.</p>
        </div>
      </div>
    </div>
  );
}
