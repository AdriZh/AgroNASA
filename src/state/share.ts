// One-click shareable scenario links: the farm scenario (location, area, pack, history, budget and
// resources) plus the what-if climate settings, packed as compact JSON → base64url in the URL hash:
//   #/compare?s=<token>
// Weather is never in the link: it is refetched from NASA POWER (or comes from the bundled / cached copy).
// Decoding validates every field and never throws; a malformed link leaves the current scenario untouched.
// The codec and validator live in shareCodec.ts (re-exported here).
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { normalizeWhatIf, WHATIF_NONE, type WhatIf } from '../engine/whatif';
import { useApp } from './AppContext';
import { decodeShare, sameScenario, tokenFromHash } from './shareCodec';

export * from './shareCodec';

// ---------- what-if settings (shared by the Compare panel and the Share button) ----------
let whatIf: WhatIf = WHATIF_NONE;
const subs = new Set<() => void>();
export const getWhatIf = () => whatIf;
export function setWhatIf(w: WhatIf) {
  const n = normalizeWhatIf(w);
  if (n.rainScale === whatIf.rainScale && n.dT === whatIf.dT) return;
  whatIf = n;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useWhatIf = (): [WhatIf, (w: WhatIf) => void] => [useSyncExternalStore(subscribe, getWhatIf, getWhatIf), setWhatIf];

export type ShareLoadEvent = { ok: true; name: string; reused: boolean } | { ok: false; error: string };

/**
 * Restores a scenario from "#/…?s=<token>" on start-up and on every hash change, using only the existing
 * context functions (select / importScenario). The token is then removed from the address bar, so a reload
 * keeps whatever the person changes afterwards.
 */
export function useShareLinkLoader(onEvent: (e: ShareLoadEvent) => void) {
  const app = useApp();
  const latest = useRef({ app, onEvent });
  latest.current = { app, onEvent };
  useEffect(() => {
    const run = () => {
      const token = tokenFromHash(window.location.hash);
      if (token == null) return;
      const { app: { scenarios, select, importScenario }, onEvent: emit } = latest.current;
      const route = window.location.hash.split('?')[0] || '#/compare';
      try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${route}`); } catch { /* ignore */ }
      const r = decodeShare(token);
      if (!r.ok) { emit({ ok: false, error: r.error }); return; }
      setWhatIf(r.whatIf);
      const existing = scenarios.find((s) => sameScenario(s, r.scenario));
      if (existing) { select(existing.id); emit({ ok: true, name: existing.name, reused: true }); return; }
      const name = scenarios.some((s) => s.name === r.scenario.name) ? `${r.scenario.name} · shared` : r.scenario.name;
      importScenario({ ...r.scenario, name });
      emit({ ok: true, name, reused: false });
    };
    run();
    window.addEventListener('hashchange', run);
    return () => window.removeEventListener('hashchange', run);
  }, []);
}
