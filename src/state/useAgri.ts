// Soil-N / multi-year layer state: lazy model download, context built from the current Field Shift engine output,
// and the farmer's settings (stored on this device only, validated and clamped on read like every other store).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from './AppContext';
import { loadModel, type ModelBundle } from '../engine/agrioptima/model';
import { buildContext, DEFAULT_WEIGHTS, type AgriContext, type Weights } from '../engine/agrioptima/engine';
import { DEFAULT_SOIL_N } from '../engine/agrioptima/params';
import { errorText } from '../weather/net';

/** The discount factor is not stored here: it is the farm's own (scenario.weights.delta), shared with Compare. */
export interface AgriSettings extends Omit<Weights, 'delta'> { soilN: number; years: number; intercrops: boolean }
export const DEFAULT_SETTINGS: AgriSettings = { wSoilUsd: DEFAULT_WEIGHTS.wSoilUsd, wCarbonUsdPerT: DEFAULT_WEIGHTS.wCarbonUsdPerT, soilN: DEFAULT_SOIL_N, years: 4, intercrops: true };
export const LIMITS = {
  wSoilUsd: [0, 5], wCarbonUsdPerT: [0, 300], soilN: [0, 250], years: [2, 5],
} as const;

const LS_KEY = 'fieldshift:v1:agri';
const clamp = (v: unknown, [lo, hi]: readonly [number, number], d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function sanitizeSettings(raw: unknown): AgriSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    wSoilUsd: clamp(r.wSoilUsd, LIMITS.wSoilUsd, DEFAULT_SETTINGS.wSoilUsd),
    wCarbonUsdPerT: clamp(r.wCarbonUsdPerT, LIMITS.wCarbonUsdPerT, DEFAULT_SETTINGS.wCarbonUsdPerT),
    soilN: clamp(r.soilN, LIMITS.soilN, DEFAULT_SETTINGS.soilN),
    years: Math.round(clamp(r.years, LIMITS.years, DEFAULT_SETTINGS.years)),
    intercrops: typeof r.intercrops === 'boolean' ? r.intercrops : DEFAULT_SETTINGS.intercrops,
  };
}

function readSettings(): AgriSettings {
  try { const raw = localStorage.getItem(LS_KEY); if (raw && raw.length < 2000) return sanitizeSettings(JSON.parse(raw)); } catch { /* private mode / corrupt */ }
  return DEFAULT_SETTINGS;
}

let shared = readSettings();
const listeners = new Set<(s: AgriSettings) => void>();

/** Settings shared by the Compare tab and the multi-year page. */
export function useAgriSettings(): [AgriSettings, (patch: Partial<AgriSettings>) => void] {
  const [s, setS] = useState(shared);
  useEffect(() => { listeners.add(setS); return () => { listeners.delete(setS); }; }, []);
  const update = useCallback((patch: Partial<AgriSettings>) => {
    shared = sanitizeSettings({ ...shared, ...patch });
    try { localStorage.setItem(LS_KEY, JSON.stringify(shared)); } catch { /* quota */ }
    listeners.forEach((f) => f(shared));
  }, []);
  return [s, update];
}

type Status = 'loading' | 'ready' | 'error';

/** The INRAE model bundle (downloaded on first use) and the context for the active farm. */
export function useAgri(): { status: Status; error?: string; ctx: AgriContext | null; bundle: ModelBundle | null; retry: () => void } {
  const { engine, scenario, data, soil } = useApp();
  const [bundle, setBundle] = useState<ModelBundle | null>(null);
  const [err, setErr] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setErr(undefined);
    loadModel().then((b) => { if (alive) setBundle(b); }, (e) => { if (alive) setErr(errorText(e)); });
    return () => { alive = false; };
  }, [attempt]);
  const built = useMemo(() => {
    if (!bundle || !engine || !data.series || !soil) return { ctx: null, error: undefined };
    try { return { ctx: buildContext(bundle, scenario, engine, data.series, soil), error: undefined }; }
    catch (e) { return { ctx: null, error: errorText(e) }; }
  }, [bundle, engine, scenario, data.series, soil]);
  const error = err ?? built.error;
  return { status: error ? 'error' : built.ctx ? 'ready' : 'loading', error, ctx: built.ctx, bundle, retry: () => setAttempt((a) => a + 1) };
}
