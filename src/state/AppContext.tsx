import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DailySeries, FarmScenario, SoilProfile } from '../domain/types';
import { DEMOS, DEMO_SENEGAL } from './demo';
import { detectPack, packById } from '../data/regionPacks';
import { fetchPower, powerGridCell } from '../weather/power';
import { effectiveSoil, fetchSoil } from '../soil/soil';
import { baselineCrops, initialPlaceholder, refreshPlaceholder, runEngine, type EngineOutput } from '../engine/plan';
import { cropFor } from '../data/crops';
import { reviewSeason, type SeasonReview } from '../engine/review';
import { fetchForecast, reverseCountry, type Forecast } from '../weather/forecast';
import { countryInfo, fxFactor } from '../data/countries';
import { idbClear } from './idb';
import { loadSpace, type SpaceData } from './space';

const LS_KEY = 'fieldshift:v1:scenarios';
const LS_ACTIVE = 'fieldshift:v1:active';

type Status = 'idle' | 'loading' | 'ready' | 'error';
export interface DataState {
  series: DailySeries | null; soilGrid: SoilProfile | null;
  weatherStatus: Status; soilStatus: Status; weatherError?: string; soilError?: string;
  weatherOrigin: 'bundled' | 'live' | 'cache' | null;
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
      const list = JSON.parse(raw) as FarmScenario[];
      if (Array.isArray(list) && list.length) return list.map((s) => ({ ...s, allowFallow: s.allowFallow ?? false }));
    }
  } catch { /* ignore */ }
  return DEMOS.map((d) => structuredClone(d));
}

const BUNDLED: { key: string; lat: number; lon: number; load: () => Promise<any> }[] = [
  { key: 'bambey', lat: 14.71, lon: -16.46, load: () => import('../data/demo/bambey.json') },
  { key: 'kostanay', lat: 53.0, lon: 64.0, load: () => import('../data/demo/kostanay.json') },
];

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
    availableFunds: 0, reserve: 0, baselineOverride: null, soil: { texture: 'unknown' }, laborAvailable: 'medium', allowFallow: false,
    needsResidue: false, // unknown for a new farm: no livestock constraint until the farmer says so
  };
  const pack = detectPack(base.location.lat, base.location.lon, base.countryIso2);
  // The farmer already manages the labor of their usual plan, so the default must not block it (at least 'medium').
  const LABOR = ['low', 'medium', 'high'] as const;
  const need = Math.max(1, ...baselineCrops(base, pack).map((c) => LABOR.indexOf(cropFor(pack, c).labor)));
  base.laborAvailable = LABOR[need];
  return { ...base, ...initialPlaceholder(base, pack) };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [scenarios, setScenarios] = useState<FarmScenario[]>(loadScenarios);
  const [activeId, setActiveId] = useState<string>(() => { try { return localStorage.getItem(LS_ACTIVE) || DEMOS[0].id; } catch { return DEMOS[0].id; } });
  const scenario = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const [data, setData] = useState<DataState>({ series: null, soilGrid: null, weatherStatus: 'idle', soilStatus: 'idle', weatherOrigin: null });
  const [forecast, setForecast] = useState<{ data: Forecast | null; status: Status; error?: string; key?: string }>({ data: null, status: 'idle' });
  const loadSeq = useRef(0);
  const [space, setSpace] = useState<{ data: SpaceData | null; status: Status; error?: string; key?: string; progress: { label: string; done: number; total: number } | null }>({ data: null, status: 'idle', progress: null });

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(scenarios)); localStorage.setItem(LS_ACTIVE, activeId); } catch { /* quota */ } }, [scenarios, activeId]);

  const update = useCallback((fn: (s: FarmScenario) => FarmScenario) => {
    setScenarios((list) => list.map((s) => (s.id === (scenario?.id) ? fn(s) : s)));
  }, [scenario?.id]);

  const { lat, lon } = scenario.location;
  const cellKey = (() => { const c = powerGridCell(lat, lon); return `${c.cLat}:${c.cLon}`; })();

  // Weather and soil load independently: the plan appears as soon as NASA POWER arrives,
  // and slow SoilGrids responses (5–30 s) only refine the soil water capacity afterwards.
  const load = useCallback(async (forceLive: boolean) => {
    const seq = ++loadSeq.current;
    setData((d) => ({ ...d, series: null, soilGrid: null, weatherStatus: 'loading', soilStatus: 'loading', weatherError: undefined, soilError: undefined, weatherOrigin: null }));
    const cell = powerGridCell(lat, lon);
    const bundled = BUNDLED.find((b) => { const c = powerGridCell(b.lat, b.lon); return c.cLat === cell.cLat && c.cLon === cell.cLon; });
    const bundledData = async () => { const mod = await bundled!.load(); return mod.default ?? mod; };

    const weather = (async () => {
      let series: DailySeries | null = null, origin: DataState['weatherOrigin'] = null, werr: string | undefined;
      if (bundled && !forceLive) { series = (await bundledData()).series; origin = 'bundled'; }
      else {
        try { const r = await fetchPower(lat, lon, { force: forceLive }); series = r.series; origin = r.fromCache ? 'cache' : 'live'; werr = r.error; }
        catch (e: any) { werr = e?.message ?? String(e); if (bundled) { series = (await bundledData()).series; origin = 'bundled'; } }
      }
      if (seq !== loadSeq.current) return;
      setData((d) => ({ ...d, series, weatherOrigin: origin, weatherStatus: series ? 'ready' : 'error', weatherError: werr }));
    })();
    const soilTask = (async () => {
      let soilGrid: SoilProfile | null = null, serr: string | undefined;
      if (bundled && !forceLive) soilGrid = (await bundledData()).soil;
      else {
        try { soilGrid = await fetchSoil(lat, lon); if (!soilGrid) serr = 'SoilGrids has no data here (water, urban or masked area).'; }
        catch (e: any) { serr = e?.message ?? String(e); if (bundled) soilGrid = (await bundledData()).soil ?? null; }
      }
      if (seq !== loadSeq.current) return;
      setData((d) => ({ ...d, soilGrid, soilStatus: soilGrid ? 'ready' : 'error', soilError: serr }));
    })();
    await Promise.all([weather, soilTask]);
  }, [lat, lon]);

  useEffect(() => { const t = setTimeout(() => load(false), 250); return () => clearTimeout(t); }, [cellKey, load]);

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
    if (!data.series || !soil) return { engine: null, engineError: null };
    try { return { engine: runEngine(scenario, data.series, soil, pack), engineError: null }; }
    catch (e: any) { return { engine: null, engineError: e?.message ?? String(e) }; }
  }, [scenario, data.series, soil, pack]);

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
    if (forecast.key === key && forecast.status !== 'error') return;
    setForecast({ data: null, status: 'loading', key });
    try { setForecast({ data: await fetchForecast(lat, lon), status: 'ready', key }); }
    catch (e: any) { setForecast({ data: null, status: 'error', error: e?.message ?? String(e), key }); }
  }, [lat, lon, forecast.key, forecast.status]);

  const spaceKey = `${lat.toFixed(3)}:${lon.toFixed(3)}:${engine?.pack.id}:${engine?.baseline.crops.join()}`;
  const loadSpaceData = useCallback(async () => {
    if (!engine) return;
    if (space.key === spaceKey && (space.status === 'ready' || space.status === 'loading')) return;
    setSpace({ data: null, status: 'loading', key: spaceKey, progress: null });
    try {
      const d = await loadSpace(lat, lon, engine, (label, done, total) => setSpace((s) => (s.key === spaceKey ? { ...s, progress: { label, done, total } } : s)));
      setSpace((s) => (s.key === spaceKey ? { data: d, status: 'ready', key: spaceKey, progress: null } : s));
    } catch (e: any) { setSpace((s) => (s.key === spaceKey ? { data: null, status: 'error', error: e?.message ?? String(e), key: spaceKey, progress: null } : s)); }
  }, [engine, lat, lon, spaceKey, space.key, space.status]);

  const ctx: Ctx = {
    scenario, scenarios, update,
    select: (id) => setActiveId(id),
    createNew: (at) => { const s = blankScenario(at); setScenarios((l) => [...l, s]); setActiveId(s.id); },
    resetDemo: (id) => { const d = DEMOS.find((x) => x.id === id); if (!d) return; setScenarios((l) => (l.some((s) => s.id === id) ? l.map((s) => (s.id === id ? structuredClone(d) : s)) : [...l, structuredClone(d)])); setActiveId(id); },
    importScenario: (s) => { const copy = { ...s, id: `import-${Date.now()}` }; setScenarios((l) => [...l, copy]); setActiveId(copy.id); },
    deleteAll: async () => { try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_ACTIVE); } catch { /* */ } await idbClear(); setScenarios(DEMOS.map((d) => structuredClone(d))); setActiveId(DEMOS[0].id); },
    data, refreshLive: () => load(true),
    engine, engineError, reviews, soil,
    forecast: { data: forecast.data, status: forecast.status, error: forecast.error, load: loadForecast },
    space: { data: space.key === spaceKey ? space.data : null, status: space.key === spaceKey ? space.status : 'idle', error: space.error, progress: space.progress, load: loadSpaceData },
  };
  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}
