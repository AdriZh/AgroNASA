// Onboarding: two short steps that each fit in one window.
//   1 · Your field      — draw the outline (or pin + area), GPS / search, place name, project name
//   2 · What grew here  — last seasons; soil and fertilizer only when expanded
// Region pack, country, currency and SoilGrids are detected in the background (AppContext).
import { useEffect, useRef, useState } from 'react';
import type { Route } from '../../App';
import { ArrowLeft, ArrowRight, Check, CalendarDays, FlaskConical, MapPin, Pencil, Plus, Shovel, Trash2, Undo2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { CropSeason, FarmScenario, FertilizerApplication, SoilTexture } from '../../domain/types';
import { CROPS, cropName } from '../../data/crops';
import { FERTILIZERS, fertById } from '../../data/fertilizers';
import { detectPack, PACKS } from '../../data/regionPacks';
import { countryInfo, fxFactor } from '../../data/countries';
import { normalizeApplication, fmtNum, toHectares } from '../../domain/units';
import { polygonAreaHa, polygonCentroid } from '../../domain/geo';
import { reversePlace } from '../../weather/forecast';
import { TEXTURE_LABEL } from '../../soil/soil';
import { LocationSearch } from '../components/LocationPicker';
import { FieldMap } from '../components/LazyMapView';
import type { FieldMapMode } from '../components/FieldMap';
import { CropIcon } from '../components/CropIcon';
import { NumInput, Seg, uid } from '../components/common';

type Pt = [number, number];

/** Move the farm; convert budget amounts if the country (and so the currency) changes. */
function moved(s: FarmScenario, patch: { lat: number; lon: number; label?: string; iso2?: string; boundary?: Pt[] | null; areaHa?: number }): FarmScenario {
  const c = countryInfo(patch.iso2);
  const cur = c?.currency && c.currency !== s.currency ? c.currency : null;
  const k = cur ? fxFactor(s.currency, cur) : 1;
  return {
    ...s,
    location: { lat: patch.lat, lon: patch.lon, label: patch.label ?? s.location.label },
    boundary: patch.boundary === undefined ? s.boundary : patch.boundary,
    ...(patch.areaHa != null ? { area: Math.round(patch.areaHa * 100) / 100, areaUnit: 'ha' as const } : {}),
    regionPackId: undefined,
    countryIso2: patch.iso2 ?? s.countryIso2,
    ...(cur ? { currency: cur, priceOverrides: {}, availableFunds: Math.round(s.availableFunds * k), reserve: Math.round(s.reserve * k) } : {}),
  };
}

export function FarmPage({ go }: { go: (r: Route) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  return (
    <div className="onboard">
      <ol className="onboard-steps" aria-label="Set up your farm">
        <li className={step === 1 ? 'on' : 'done'}><button type="button" aria-current={step === 1 ? 'step' : undefined} onClick={() => setStep(1)}><span>{step === 1 ? 1 : <Check size={14} />}</span>Your field</button></li>
        <li className={step === 2 ? 'on' : ''}><button type="button" aria-current={step === 2 ? 'step' : undefined} onClick={() => setStep(2)}><span>2</span>What grew here</button></li>
      </ol>
      {step === 1 ? <FieldStep onNext={() => setStep(2)} /> : <HistoryStep onBack={() => setStep(1)} onNext={() => go('resources')} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Step 1 · Your field
// ---------------------------------------------------------------------------------------------------------------

function FieldStep({ onNext }: { onNext: () => void }) {
  const { scenario: sc, update } = useApp();
  const [mode, setMode] = useState<FieldMapMode>('draw');
  const [draft, setDraft] = useState<Pt[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const seq = useRef(0);
  useEffect(() => { setDraft([]); setFocusKey((k) => k + 1); }, [sc.id]);

  /** Look up the place name for a point the farmer chose on the map. */
  const name = async (lat: number, lon: number) => {
    const n = ++seq.current;
    setLocating(true);
    try {
      const r = await reversePlace(lat, lon);
      if (n !== seq.current || !r) return;
      update((s) => (s.location.lat === lat && s.location.lon === lon ? moved(s, { lat, lon, label: r.label, iso2: r.iso2 }) : s));
    } catch { /* offline: the coordinates stay as the label */ } finally { if (n === seq.current) setLocating(false); }
  };

  const finish = (pts: Pt[]) => {
    if (pts.length < 3) return;
    const [lat, lon] = polygonCentroid(pts).map((x) => Number(x.toFixed(5))) as Pt;
    update((s) => moved(s, { lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, boundary: pts, areaHa: polygonAreaHa(pts) }));
    setDraft([]);
    name(lat, lon);
  };
  const pin = ([lat, lon]: Pt) => {
    update((s) => moved(s, { lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, boundary: null }));
    name(lat, lon);
  };

  const pack = detectPack(sc.location.lat, sc.location.lon, sc.countryIso2);
  const country = countryInfo(sc.countryIso2);
  const areaHa = toHectares(sc.area, sc.areaUnit);
  const drawn = !!sc.boundary && sc.boundary.length >= 3;

  return (
    <div className="onboard-body field-step">
      <div className="onboard-map">
        <FieldMap lat={sc.location.lat} lon={sc.location.lon} boundary={sc.boundary} mode={mode} draft={draft}
          onPin={pin} onDraft={setDraft} onClose={() => finish(draft)} focusKey={focusKey} />
      </div>

      <aside className="onboard-panel">
        <div>
          <h1>Where is your field?</h1>
          <p className="mini">Draw its outline on the map, or drop a pin and type the area.</p>
        </div>

        <LocationSearch compact onPick={(p) => { update((s) => moved(s, { lat: p.lat, lon: p.lon, label: p.label, iso2: p.iso2, boundary: null })); setDraft([]); setFocusKey((k) => k + 1); if (!p.iso2 || p.label === 'My location') name(p.lat, p.lon); }} />

        <Seg label="How to mark the field" value={mode} onChange={(v) => { setMode(v); setDraft([]); }}
          options={[{ v: 'draw', label: <><Pencil size={14} /> Draw field</> }, { v: 'pin', label: <><MapPin size={14} /> Pin + area</> }]} />

        {mode === 'draw' ? (
          <div className="draw-status">
            {draft.length > 0 ? (
              <>
                <p><b>{draft.length} corner{draft.length === 1 ? '' : 's'}</b>{draft.length >= 3 ? ` · ${fmtNum(polygonAreaHa(draft), 2)} ha` : ''} — {draft.length >= 3 ? 'tap the first corner or Finish.' : 'keep tapping the corners.'}</p>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn primary sm" disabled={draft.length < 3} onClick={() => finish(draft)}><Check size={14} /> Finish</button>
                  <button type="button" className="btn sm" onClick={() => setDraft(draft.slice(0, -1))}><Undo2 size={14} /> Undo</button>
                  <button type="button" className="btn ghost sm" onClick={() => setDraft([])}>Clear</button>
                </div>
              </>
            ) : drawn ? (
              <p><b>Field drawn · {fmtNum(areaHa, 2)} ha.</b> Tap the map to draw it again.</p>
            ) : (
              <p>Tap each corner of your field on the map.</p>
            )}
          </div>
        ) : (
          <div className="draw-status">
            <p>Tap your field on the map, then enter its size.</p>
            <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
              <NumInput label="Field area" value={sc.area} min={0} step={0.1} onChange={(v) => update((s) => ({ ...s, area: Math.max(0.01, v ?? 0.01), boundary: null }))} />
              <select className="input" style={{ width: 'auto' }} aria-label="Area unit" value={sc.areaUnit} onChange={(e) => update((s) => ({ ...s, areaUnit: e.target.value as FarmScenario['areaUnit'] }))}>
                <option value="ha">hectares</option><option value="acre">acres</option><option value="m2">m²</option>
              </select>
            </div>
          </div>
        )}

        <div className="place-card" aria-live="polite">
          <MapPin size={16} aria-hidden />
          <div>
            <b>{locating ? 'Finding the place name…' : sc.location.label || `${sc.location.lat.toFixed(4)}, ${sc.location.lon.toFixed(4)}`}</b>
            <span className="mini">{fmtNum(areaHa, 2)} ha{country ? ` · ${country.name}` : ''} · {pack.short}</span>
          </div>
        </div>

        <label className="field">Project name
          <input className="input" value={sc.name} placeholder="e.g. North field 2027" onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} />
        </label>

        <details className="mini region-fix">
          <summary>Wrong farming region?</summary>
          <select className="input sm" value={sc.regionPackId ?? ''} onChange={(e) => update((s) => ({ ...s, regionPackId: e.target.value || undefined }))} aria-label="Farming region">
            <option value="">Auto: {detectPack(sc.location.lat, sc.location.lon, sc.countryIso2).name}</option>
            {PACKS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </details>

        <button type="button" className="btn primary onboard-next" onClick={onNext}>Next: what grew here <ArrowRight /></button>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Step 2 · What grew here
// ---------------------------------------------------------------------------------------------------------------

const OUTCOMES = ['good', 'average', 'poor', 'failed', 'unknown'] as const;

function HistoryStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { scenario: sc, update, engine } = useApp();
  const pack = engine?.pack ?? detectPack(sc.location.lat, sc.location.lon, sc.countryIso2);
  const crops = [...new Set([...pack.crops, ...sc.history.map((h) => h.cropId)])].filter((c) => CROPS[c]);
  const multiSeason = pack.seasons.length > 1;
  const hist = [...sc.history].sort((a, b) => b.year - a.year);

  const setH = (id: string, patch: Partial<CropSeason>) => update((s) => ({ ...s, history: s.history.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  const addH = () => update((s) => {
    const first = [...s.history].sort((a, b) => a.year - b.year)[0];
    const year = first ? first.year - 1 : s.firstSeasonYear - 1;
    return { ...s, history: [...s.history, { id: uid(), cropId: pack.crops.find((c) => c !== 'fallow') ?? pack.crops[0], year, approximateDate: true, outcome: 'unknown' }] };
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

  return (
    <div className="onboard-body history-step">
      <section className="onboard-panel history-main">
        <div>
          <h1>What grew here before?</h1>
          <p className="mini">Your last 1–3 seasons, newest first. Unknown is fine — it stays unknown. Yield is optional and calibrates the predictions to your field.</p>
        </div>
        <div className="history-list">
          {hist.length === 0 && <p className="mini">No seasons yet. Add the crop you grew last.</p>}
          {hist.map((h) => (
            <div key={h.id} className={`history-row ${multiSeason ? 'multi' : ''}`}>
              <NumInput className="sm" label="Year" value={h.year} onChange={(v) => setH(h.id, { year: Math.round(v ?? h.year) })} />
              {multiSeason && (
                <select className="input sm" aria-label="Season" value={h.seasonId ?? pack.seasons.find((x) => x.crops.includes(h.cropId))?.id ?? pack.seasons[0].id} onChange={(e) => setH(h.id, { seasonId: e.target.value })}>
                  {pack.seasons.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              )}
              <span className="crop-name"><CropIcon id={h.cropId} size={20} />
                <select className="input sm" aria-label="Crop" value={h.cropId} onChange={(e) => setH(h.id, { cropId: e.target.value })}>
                  {[...new Set([...crops, ...Object.keys(CROPS)])].map((c) => <option key={c} value={c}>{cropName(c)}</option>)}
                </select>
              </span>
              <select className="input sm" aria-label="How did it go?" value={h.outcome ?? 'unknown'} onChange={(e) => setH(h.id, { outcome: e.target.value as CropSeason['outcome'] })}>
                {OUTCOMES.map((o) => <option key={o} value={o}>{o === 'unknown' ? 'result?' : o}</option>)}
              </select>
              <NumInput className="sm" label="Yield, t/ha (optional)" allowNull placeholder="yield t/ha" value={h.yieldTHa ?? null} onChange={(v) => setH(h.id, { yieldTHa: v })} />
              <button type="button" className="btn ghost danger icon sm" onClick={() => delH(h.id)} aria-label="Delete season"><Trash2 /></button>
            </div>
          ))}
        </div>
        <div><button type="button" className="btn sm" onClick={addH}><Plus /> Add a season</button></div>
      </section>

      <aside className="onboard-side">
        <details className="card disclose">
          <summary><Shovel />Soil <span className="mini">optional</span></summary>
          <div className="body stack-sm">
            <label className="field">Texture (feel or local name)
              <select className="input" value={sc.soil.texture} onChange={(e) => update((s) => ({ ...s, soil: { ...s.soil, texture: e.target.value as SoilTexture } }))}>
                {Object.entries(TEXTURE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field">Lab pH (from a soil test)
              <NumInput allowNull value={sc.soil.labPh ?? null} onChange={(v) => update((s) => ({ ...s, soil: { ...s.soil, labPh: v } }))} />
            </label>
            <p className="mini">Leave as “unknown” and Field Shift uses the SoilGrids map for this point.</p>
          </div>
        </details>

        <details className="card disclose" open={sc.fertilizer.length > 0}>
          <summary><FlaskConical />Fertilizer &amp; manure <span className="mini">optional{sc.fertilizer.length ? ` · ${sc.fertilizer.length}` : ''}</span></summary>
          <div className="body stack-sm">
            {sc.fertilizer.map((f) => {
              const nm = normalizeApplication(f);
              return (
                <div key={f.id} className="fert-row">
                  <select className="input sm" aria-label="Season" value={f.cropSeasonId} onChange={(e) => setF(f.id, { cropSeasonId: e.target.value })}>
                    {hist.map((h) => <option key={h.id} value={h.id}>{h.year} {cropName(h.cropId)}</option>)}
                  </select>
                  <select className="input sm" aria-label="Product" value={f.productId} onChange={(e) => { const p = fertById(e.target.value)!; setF(f.id, { productId: p.id, productName: p.name, type: p.type, n: p.n, p2o5: p.p2o5, k2o: p.k2o, bagMassKg: f.bagMassKg ?? p.bagKg }); }}>
                    {FERTILIZERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <NumInput className="sm" label="Amount" allowNull placeholder="amount" value={f.quantity} onChange={(v) => setF(f.id, { quantity: v })} />
                    <select className="input sm" style={{ width: 'auto' }} aria-label="Unit" value={f.quantityUnit} onChange={(e) => setF(f.id, { quantityUnit: e.target.value as FertilizerApplication['quantityUnit'] })}>{['bag', 'kg', 't', 'L'].map((u) => <option key={u}>{u}</option>)}</select>
                    <NumInput className="sm" label="Area treated, ha" allowNull placeholder="on ha" value={f.treatedAreaHa ?? null} onChange={(v) => setF(f.id, { treatedAreaHa: v })} />
                    <button type="button" className="btn ghost danger icon sm" onClick={() => delF(f.id)} aria-label="Delete application"><Trash2 /></button>
                  </div>
                  <span className="mini">{nm.nKgHa != null ? `≈ ${fmtNum(nm.nKgHa, 0)} kg N/ha` : 'N per ha unknown until amount and area are set'}</span>
                </div>
              );
            })}
            <button type="button" className="btn sm" onClick={addF} disabled={!sc.history.length}><Plus /> Add fertilizer or manure</button>
            {!sc.history.length && <p className="mini">Add a season first.</p>}
          </div>
        </details>

        <p className="mini side-note"><CalendarDays size={14} /> Planting dates are estimated from NASA rain and temperature records, so you don’t need to enter them.</p>
      </aside>

      <div className="onboard-foot">
        <button type="button" className="btn" onClick={onBack}><ArrowLeft /> Your field</button>
        <button type="button" className="btn primary" onClick={onNext}>Next: budget <ArrowRight /></button>
      </div>
    </div>
  );
}
