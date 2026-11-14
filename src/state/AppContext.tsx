import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DailySeries, FarmScenario, SoilProfile } from '../domain/types';
import { DEMOS, DEMO_SENEGAL } from './demo';
import { detectPack, packById } from '../data/regionPacks';
import { fetchPower, powerGridCell } from '../weather/power';
import { effectiveSoil, fetchSoil } from '../soil/soil';
import { runEngine, type EngineOutput } from '../engine/plan';
import { reviewSeason, type SeasonReview } from '../engine/review';
import { fetchForecast, type Forecast } from '../weather/forecast';
import { idbClear } from './idb';

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
  select: (id: string) => void; createNew: () => void; resetDemo: (id: string) => void; importScenario: (s: FarmScenario) => void;
  deleteAll: () => Promise<void>;
  data: DataState; refreshLive: () => void;
  engine: EngineOutput | null; engineError: string | null; reviews: SeasonReview[];
  soil: SoilProfile | null;
  forecast: { data: Forecast | null; status: Status; error?: string; load: () => void };
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

export function blankScenario(): FarmScenario {
  return {
    ...structuredClone(DEMO_SENEGAL), id: `farm-${Date.now()}`, name: 'My farm', synthetic: false,
    history: [], fertilizer: [], confirmedInflows: [], priceOverrides: {}, unavailableCrops: [], marketCrops: [],
    availableFunds: 0, reserve: 0, baselineOverride: null, soil: { texture: 'unknown' },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [scenarios, setScenarios] = useState<FarmScenario[]>(loadScenarios);
  const [activeId, setActiveId] = useState<string>(() => { try { return localStorage.getItem(LS_ACTIVE) || DEMOS[0].id; } catch { return DEMOS[0].id; } });
  const scenario = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const [data, setData] = useState<DataState>({ series: null, soilGrid: null, weatherStatus: 'idle', soilStatus: 'idle', weatherOrigin: null });
  const [forecast, setForecast] = useState<{ data: Forecast | null; status: Status; error?: string; key?: string }>({ data: null, status: 'idle' });
  const loadSeq = useRef(0);

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(scenarios)); localStorage.setItem(LS_ACTIVE, activeId); } catch { /* quota */ } }, [scenarios, activeId]);

  const update = useCallback((fn: (s: FarmScenario) => FarmScenario) => {
    setScenarios((list) => list.map((s) => (s.id === (scenario?.id) ? fn(s) : s)));
  }, [scenario?.id]);

  const { lat, lon } = scenario.location;
  const cellKey = (() => { const c = powerGridCell(lat, lon); return `${c.cLat}:${c.cLon}`; })();

  const load = useCallback(async (forceLive: boolean) => {
    const seq = ++loadSeq.current;
    setData((d) => ({ ...d, weatherStatus: 'loading', soilStatus: 'loading', weatherError: undefined, soilError: undefined }));
    const cell = powerGridCell(lat, lon);
    const bundled = BUNDLED.find((b) => { const c = powerGridCell(b.lat, b.lon); return c.cLat === cell.cLat && c.cLon === cell.cLon; });
    let series: DailySeries | null = null, origin: DataState['weatherOrigin'] = null, werr: string | undefined;
    let soilGrid: SoilProfile | null = null, serr: string | undefined;
    if (bundled && !forceLive) {
      const mod = await bundled.load();
      const d = mod.default ?? mod;
      series = d.series; soilGrid = d.soil; origin = 'bundled';
    } else {
      try {
        const r = await fetchPower(lat, lon, { force: forceLive });
        series = r.series; origin = r.fromCache ? 'cache' : 'live'; werr = r.error;
      } catch (e: any) {
        werr = e?.message ?? String(e);
        if (bundled) { const mod = await bundled.load(); series = (mod.default ?? mod).series; origin = 'bundled'; }
      }
      try { soilGrid = await fetchSoil(lat, lon); if (!soilGrid) serr = 'SoilGrids has no data here (water, urban or masked area).'; }
      catch (e: any) {
        serr = e?.message ?? String(e);
        if (bundled) soilGrid = (await bundled.load()).default?.soil ?? null;
      }
    }
    if (seq !== loadSeq.current) return;
    setData({ series, soilGrid, weatherOrigin: origin, weatherStatus: series ? 'ready' : 'error', soilStatus: soilGrid ? 'ready' : 'error', weatherError: werr, soilError: serr });
  }, [lat, lon]);

  useEffect(() => { const t = setTimeout(() => load(false), 250); return () => clearTimeout(t); }, [cellKey, load]);

  const pack = useMemo(() => packById(scenario.regionPackId) ?? detectPack(lat, lon), [scenario.regionPackId, lat, lon]);
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

  const reviews = useMemo(() => {
    if (!engine || !data.series || !soil) return [];
    return [...scenario.history].sort((a, b) => b.year - a.year).map((h) => reviewSeason(scenario, h, data.series!, engine.window, soil)).filter((x): x is SeasonReview => !!x);
  }, [engine, scenario, data.series, soil]);

  const loadForecast = useCallback(async () => {
    const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
    if (forecast.key === key && forecast.status !== 'error') return;
    setForecast({ data: null, status: 'loading', key });
    try { setForecast({ data: await fetchForecast(lat, lon), status: 'ready', key }); }
    catch (e: any) { setForecast({ data: null, status: 'error', error: e?.message ?? String(e), key }); }
  }, [lat, lon, forecast.key, forecast.status]);

  const ctx: Ctx = {
    scenario, scenarios, update,
    select: (id) => setActiveId(id),
    createNew: () => { const s = blankScenario(); setScenarios((l) => [...l, s]); setActiveId(s.id); },
    resetDemo: (id) => { const d = DEMOS.find((x) => x.id === id); if (!d) return; setScenarios((l) => (l.some((s) => s.id === id) ? l.map((s) => (s.id === id ? structuredClone(d) : s)) : [...l, structuredClone(d)])); setActiveId(id); },
    importScenario: (s) => { const copy = { ...s, id: `import-${Date.now()}` }; setScenarios((l) => [...l, copy]); setActiveId(copy.id); },
    deleteAll: async () => { try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_ACTIVE); } catch { /* */ } await idbClear(); setScenarios(DEMOS.map((d) => structuredClone(d))); setActiveId(DEMOS[0].id); },
    data, refreshLive: () => load(true),
    engine, engineError, reviews, soil,
    forecast: { data: forecast.data, status: forecast.status, error: forecast.error, load: loadForecast },
  };
  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}
