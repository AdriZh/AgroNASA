import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DailySeries, FarmScenario, SoilProfile } from '../domain/types';
import { DEMOS, DEMO_SENEGAL, bundledFor, loadBundled, startBundledPreload } from './demo';
import { detectPack, packById } from '../data/regionPacks';
import { fetchPower, powerGridCell } from '../weather/power';
import { effectiveSoil, fetchSoil } from '../soil/soil';
import { DEFAULT_WEIGHTS, initialPlaceholder, refreshPlaceholder, runEngine, type EngineOutput } from '../engine/plan';
import { reviewSeason, type SeasonReview } from '../engine/review';
import { fetchForecast, reverseCountry, type Forecast } from '../weather/forecast';
import { countryInfo, faostatReady, fxFactor, loadFaostat } from '../data/countries';
import { errorText } from '../weather/net';
import { idbClear } from './idb';
import { loadSpace, type SpaceData } from './space';
import { sanitizeScenario } from './shareCodec';

const LS_KEY = 'fieldshift:v1:scenarios';
const LS_ACTIVE = 'fieldshift:v1:active';

type Status = 'idle' | 'loading' | 'ready' | 'error';
/** Minimum wait before an optional panel (forecast, GIBS) asks a failed service again. */
const RETRY_AFTER_MS = 30_000;
export interface DataState {
  series: DailySeries | null; soilGrid: SoilProfile | null;
  weatherStatus: Status; soilStatus: Status; weatherError?: string; soilError?: string;
  weatherOrigin: 'bundled' | 'live' | 'cache' | null;
  /** Where the soil profile came from; "typical" = SoilGrids unreachable or masked, typical values for the texture class are used. */
  soilOrigin: 'bundled' | 'live' | 'cache' | 'typical' | null;
}

interface Ctx {
  scenario: FarmScenario; scenarios: FarmScenario[];
  update: (fn: (s: FarmScenario) => FarmScenario) => void;
  select: (id: string) => void; createNew: (at?: { lat: number; lon: number; label?: string; iso2?: string }) => void; resetDemo: (id: string) => void; importScenario: (s: FarmScenario) => void;
  deleteAll: () => Promise<void>;
  data: DataState; refreshLive: () => void;
  engine: EngineOutput | null; engineError: string | null; reviews: SeasonReview[];
  soil: SoilProfile | null;
  forecast: { data: Forecast | null; status: Status; error?: string; load: () => void };
  space: { data: SpaceData | null; status: Status; error?: string; progress: { label: string; done: number; total: number } | null; load: () => void };
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('no ctx'); return c; };

function loadScenarios(): FarmScenario[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      // device storage is validated like a share link: a corrupted or tampered entry is skipped, not rendered
      const list: unknown = JSON.parse(raw);
      const ok = Array.isArray(list) ? list.slice(0, 200).map((s) => sanitizeScenario(s, { keepIds: true })).flatMap((r) => (r.ok ? [r.scenario] : [])) : [];
      if (ok.length) return ok;
    }
  } catch { /* ignore */ }
  return DEMOS.map((d) => structuredClone(d));
}

// Start the downloads the first screen needs (archived demo snapshot + FAOSTAT prices) before React mounts,
// in parallel with the rest of the app instead of after the first render.
(() => {
  if (typeof window === 'undefined') return;
  let active: string | null = null;
  try { active = localStorage.getItem(LS_ACTIVE); } catch { /* private mode */ }
  startBundledPreload(loadScenarios(), active);
  loadFaostat().catch(() => { /* retried in AppProvider */ });
})();

/**
 * A new / custom farm. Its funds and reserve are a flagged placeholder sized from the usual plan's cash cost
 * (≈90% of it is spendable, see placeholderBudget in engine/budget.ts), not a flat amount per hectare — the old
 * 900 USD/ha default made every plan affordable in low-cost regions and none in high-cost ones. The placeholder is
 * re-derived while the farmer has not edited it, whenever the pack, currency, area or usual plan changes.
 */
export function blankScenario(at?: { lat: number; lon: number; label?: string; iso2?: string }): FarmScenario {
  const c = countryInfo(at?.iso2);
  const base: FarmScenario = {
    ...structuredClone(DEMO_SENEGAL), id: `farm-${Date.now()}`, name: at?.label ? `My farm · ${at.label.split(',')[0]}` : 'My farm', synthetic: false,
    location: at ? { lat: at.lat, lon: at.lon, label: at.label } : structuredClone(DEMO_SENEGAL.location),
    countryIso2: at ? at.iso2 : 'SN', currency: c?.currency ?? (at ? 'USD' : 'XOF'), area: 1, areaUnit: 'ha',
    history: [], fertilizer: [], confirmedInflows: [], priceOverrides: {}, unavailableCrops: [], marketCrops: [],
    availableFunds: 0, reserve: 0, baselineOverride: null, soil: { texture: 'unknown' }, weights: { ...DEFAULT_WEIGHTS }, allowFallow: true,
    needsResidue: false, // unknown for a new farm: no livestock constraint until the farmer says so
  };
  const pack = detectPack(base.location.lat, base.location.lon, base.countryIso2);
  return { ...base, ...initialPlaceholder(base, pack) };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [scenarios, setScenarios] = useState<FarmScenario[]>(loadScenarios);
  const [activeId, setActiveId] = useState<string>(() => { try { return localStorage.getItem(LS_ACTIVE) || DEMOS[0].id; } catch { return DEMOS[0].id; } });
  const scenario = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const [data, setData] = useState<DataState>({ series: null, soilGrid: null, weatherStatus: 'idle', soilStatus: 'idle', weatherOrigin: null, soilOrigin: null });
  const [forecast, setForecast] = useState<{ data: Forecast | null; status: Status; error?: string; key?: string; at?: number }>({ data: null, status: 'idle' });
  const loadSeq = useRef(0);
  const [space, setSpace] = useState<{ data: SpaceData | null; status: Status; error?: string; key?: string; at?: number; progress: { label: string; done: number; total: number } | null }>({ data: null, status: 'idle', progress: null });

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(scenarios)); localStorage.setItem(LS_ACTIVE, activeId); } catch { /* quota */ } }, [scenarios, activeId]);

  const update = useCallback((fn: (s: FarmScenario) => FarmScenario) => {
    setScenarios((list) => list.map((s) => (s.id === (scenario?.id) ? fn(s) : s)));
  }, [scenario?.id]);

  const { lat, lon } = scenario.location;
  const cellKey = (() => { const c = powerGridCell(lat, lon); return `${c.cLat}:${c.cLon}`; })();

  // Weather and soil load independently: the plan appears as soon as NASA POWER arrives,
  // and slow SoilGrids responses (up to ~12 s) only refine the soil water capacity afterwards.
  // Every network failure degrades to a labelled fallback: archived snapshot (demo cells), device cache,
  // typical soil values for the texture class, or a clear error with a retry for weather.
  const load = useCallback(async (forceLive: boolean) => {
    const seq = ++loadSeq.current;
    // A manual refresh keeps the current charts on screen until something better arrives.
    setData((d) => (forceLive
      ? { ...d, weatherStatus: 'loading', soilStatus: 'loading', weatherError: undefined, soilError: undefined }
      : { ...d, series: null, soilGrid: null, weatherStatus: 'loading', soilStatus: 'loading', weatherError: undefined, soilError: undefined, weatherOrigin: null, soilOrigin: null }));
    const bundled = bundledFor(lat, lon);
    const archived = async () => (bundled ? loadBundled(bundled) : null);

    const weather = (async () => {
      let series: DailySeries | null = null, origin: DataState['weatherOrigin'] = null, werr: string | undefined;
      if (bundled && !forceLive) {
        try { series = (await loadBundled(bundled)).series; origin = 'bundled'; }
        catch (e) { werr = `Archived demo data failed to load (${errorText(e)})`; }
      } else {
        try { const r = await fetchPower(lat, lon, { force: forceLive }); series = r.series; origin = r.fromCache ? 'cache' : 'live'; werr = r.error; }
        catch (e) {
          werr = errorText(e);
          const snap = await archived().catch(() => null);
          if (snap) { series = snap.series; origin = 'bundled'; }
        }
      }
      if (seq !== loadSeq.current) return;
      setData((d) => {
        // a failed manual refresh keeps what was already on screen
        if (!series && forceLive && d.series) return { ...d, weatherStatus: 'ready', weatherError: werr };
        return { ...d, series, weatherOrigin: origin, weatherStatus: series ? 'ready' : 'error', weatherError: werr };
      });
    })();
    const soilTask = (async () => {
      let soilGrid: SoilProfile | null = null, serr: string | undefined, origin: DataState['soilOrigin'] = null;
      if (bundled && !forceLive) {
        soilGrid = (await archived().catch(() => null))?.soil ?? null;
        origin = soilGrid ? 'bundled' : null;
      } else {
        try {
          soilGrid = await fetchSoil(lat, lon, { force: forceLive });
          if (soilGrid) origin = soilGrid.cached ? 'cache' : 'live';
          else serr = 'SoilGrids has no data here (water, urban or masked area)';
        } catch (e) {
          serr = errorText(e);
          soilGrid = (await archived().catch(() => null))?.soil ?? null;
          if (soilGrid) origin = 'bundled';
        }
      }
      if (seq !== loadSeq.current) return;
      setData((d) => {
        if (!soilGrid && forceLive && d.soilGrid) return { ...d, soilStatus: 'ready', soilError: serr };
        // No SoilGrids profile: effectiveSoil() uses the farmer's texture, or typical loam values (editable on the Farm page).
        return { ...d, soilGrid, soilStatus: 'ready', soilError: serr, soilOrigin: soilGrid ? origin : 'typical' };
      });
    })();
    await Promise.all([weather, soilTask]);
  }, [lat, lon]);

  // Archived demo cells load instantly; other cells wait briefly so typing coordinates or switching farms
  // does not fire a burst of 25-year downloads.
  useEffect(() => { const t = setTimeout(() => load(false), bundledFor(lat, lon) ? 0 : 250); return () => clearTimeout(t); }, [cellKey, load]);

  // FAOSTAT prices are code-split; the plan waits for them (they are preloaded alongside the app chunk).
  const [faoReady, setFaoReady] = useState(faostatReady);
  useEffect(() => {
    if (faoReady) return;
    let alive = true;
    const attempt = (n: number) => loadFaostat().then(() => { if (alive) setFaoReady(true); }, () => {
      if (!alive) return;
      if (n < 2) setTimeout(() => attempt(n + 1), 1500);
      else setFaoReady(true); // run with pack placeholder prices rather than never showing a plan
    });
    attempt(0);
    return () => { alive = false; };
  }, [faoReady]);

  // Country from reverse geocoding (OpenStreetMap Nominatim) → regional pack, currency and FAOSTAT prices.
  useEffect(() => {
    if (scenario.countryIso2) return;
    let alive = true;
    const t = setTimeout(async () => {
      const iso2 = await reverseCountry(lat, lon).catch(() => null);
      if (!alive || !iso2) return;
      const c = countryInfo(iso2);
      setScenarios((list) => list.map((s) => {
        if (s.id !== scenario.id || s.countryIso2) return s;
        if (!c?.currency || s.currency === c.currency) return { ...s, countryIso2: iso2 };
        const k = fxFactor(s.currency, c.currency); // keep the same real budget in the new currency
        return { ...s, countryIso2: iso2, currency: c.currency, priceOverrides: {}, availableFunds: Math.round(s.availableFunds * k), reserve: Math.round(s.reserve * k) };
      }));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [scenario.id, scenario.countryIso2, lat, lon]);

  const pack = useMemo(() => packById(scenario.regionPackId) ?? detectPack(lat, lon, scenario.countryIso2), [scenario.regionPackId, scenario.countryIso2, lat, lon]);
  const soil = useMemo(() => {
    if (!data.series) return null;
    const s = effectiveSoil(scenario.soil.texture, data.soilGrid);
    return scenario.soil.labPh != null ? { ...s, ph: scenario.soil.labPh } : s;
  }, [scenario.soil.texture, scenario.soil.labPh, data.soilGrid, data.series]);

  const { engine, engineError } = useMemo(() => {
    if (!data.series || !soil || !faoReady) return { engine: null, engineError: null };
    try { return { engine: runEngine(scenario, data.series, soil, pack), engineError: null }; }
    catch (e: any) { return { engine: null, engineError: e?.message ?? String(e) }; }
  }, [scenario, data.series, soil, pack, faoReady]);

  // Scenario defaults: keep an unedited placeholder budget in step with the plan costs at this location.
  useEffect(() => {
    if (!engine || !scenario.budgetPlaceholder) return;
    const patch = refreshPlaceholder(scenario, engine);
    if (patch) setScenarios((list) => list.map((s) => (s.id === scenario.id ? { ...s, ...patch } : s)));
  }, [engine, scenario]);

  const reviews = useMemo(() => {
    if (!engine || !data.series || !soil) return [];
    const winFor = (h: FarmScenario['history'][number]) => engine.windows.find((w) => w.id === h.seasonId) ?? engine.windows.find((w) => w.crops.includes(h.cropId)) ?? engine.window;
    return [...scenario.history].sort((a, b) => b.year - a.year).map((h) => reviewSeason(scenario, h, data.series!, winFor(h), soil, engine.pack)).filter((x): x is SeasonReview => !!x);
  }, [engine, scenario, data.series, soil]);

  const loadForecast = useCallback(async () => {
    const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
    // After a failure, wait before asking again: pages call load() whenever its identity changes, and an
    // immediate retry would hammer an API that is down or rate-limiting us.
    if (forecast.key === key && (forecast.status !== 'error' || Date.now() - (forecast.at ?? 0) < RETRY_AFTER_MS)) return;
    setForecast({ data: null, status: 'loading', key });
    try { setForecast({ data: await fetchForecast(lat, lon), status: 'ready', key }); }
    catch (e) { setForecast({ data: null, status: 'error', error: errorText(e), key, at: Date.now() }); }
  }, [lat, lon, forecast.key, forecast.status, forecast.at]);

  const spaceKey = `${lat.toFixed(3)}:${lon.toFixed(3)}:${engine?.pack.id}:${engine?.baseline.crops.join()}`;
  const loadSpaceData = useCallback(async () => {
    if (!engine) return;
    if (space.key === spaceKey && (space.status === 'ready' || space.status === 'loading' || (space.status === 'error' && Date.now() - (space.at ?? 0) < RETRY_AFTER_MS))) return;
    setSpace({ data: null, status: 'loading', key: spaceKey, progress: null });
    try {
      const d = await loadSpace(lat, lon, engine, (label, done, total) => setSpace((s) => (s.key === spaceKey ? { ...s, progress: { label, done, total } } : s)));
      setSpace((s) => (s.key === spaceKey ? { data: d, status: 'ready', key: spaceKey, progress: null } : s));
    } catch (e) { setSpace((s) => (s.key === spaceKey ? { data: null, status: 'error', error: errorText(e), key: spaceKey, at: Date.now(), progress: null } : s)); }
  }, [engine, lat, lon, spaceKey, space.key, space.status, space.at]);

  const ctx: Ctx = {
    scenario, scenarios, update,
    select: (id) => setActiveId(id),
    createNew: (at) => { const s = blankScenario(at); setScenarios((l) => [...l, s]); setActiveId(s.id); },
    resetDemo: (id) => { const d = DEMOS.find((x) => x.id === id); if (!d) return; setScenarios((l) => (l.some((s) => s.id === id) ? l.map((s) => (s.id === id ? structuredClone(d) : s)) : [...l, structuredClone(d)])); setActiveId(id); },
    // imported files are untrusted: validated (types, ranges, known crops, no extra keys) or rejected with a message
    importScenario: (s) => { const r = sanitizeScenario(s); if (!r.ok) throw new Error(r.error); const copy = { ...r.scenario, id: `import-${Date.now()}` }; setScenarios((l) => [...l, copy]); setActiveId(copy.id); },
    deleteAll: async () => { try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_ACTIVE); } catch { /* */ } await idbClear(); setScenarios(DEMOS.map((d) => structuredClone(d))); setActiveId(DEMOS[0].id); },
    data, refreshLive: () => load(true),
    engine, engineError, reviews, soil,
    forecast: { data: forecast.data, status: forecast.status, error: forecast.error, load: loadForecast },
    space: { data: space.key === spaceKey ? space.data : null, status: space.key === spaceKey ? space.status : 'idle', error: space.error, progress: space.progress, load: loadSpaceData },
  };
  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}
