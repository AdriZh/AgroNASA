// Network robustness: fetchWithTimeout error kinds, and the SoilGrids → typical-soil fallback.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchWithTimeout, isNetDown, NetError } from '../src/weather/net';
import { effectiveSoil, fetchSoil, resetSoilGridsBackoff, saxtonRawlsAwc, TEXTURE_AWC, TYPICAL_TEXTURE, typicalSoil } from '../src/soil/soil';
import { runEngine } from '../src/engine/plan';
import { DEMO_SENEGAL } from '../src/state/demo';
import { detectPack } from '../src/data/regionPacks';
import bambey from '../src/data/demo/bambey.json';

/** A fetch that never answers until its signal aborts (like rest.isric.org from a blocked network). */
const hangingFetch: typeof fetch = (_url, init) => new Promise((_res, rej) => {
  init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
});
const okFetch = (body: unknown, status = 200): typeof fetch => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => { vi.useRealTimers(); resetSoilGridsBackoff(); });

describe('fetchWithTimeout', () => {
  it('returns the response when the server answers in time', async () => {
    const res = await fetchWithTimeout('https://example.org/x', { fetchImpl: okFetch({ a: 1 }), timeoutMs: 1000 });
    expect(await res.json()).toEqual({ a: 1 });
  });

  it('aborts a hanging request after the timeout with kind "timeout"', async () => {
    const t0 = Date.now();
    const err = await fetchWithTimeout('https://example.org/slow', { fetchImpl: hangingFetch, timeoutMs: 60, service: 'Slow API' }).catch((e) => e);
    expect(err).toBeInstanceOf(NetError);
    expect(err.kind).toBe('timeout');
    expect(err.service).toBe('Slow API');
    expect(err.message).toMatch(/timed out/);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(isNetDown(err)).toBe(true);
  });

  it('reports network failures as "offline" and HTTP errors as "http" with the status', async () => {
    const down: typeof fetch = async () => { throw new TypeError('Failed to fetch'); };
    const off = await fetchWithTimeout('https://example.org/', { fetchImpl: down }).catch((e) => e);
    expect(off.kind).toBe('offline');
    expect(off.message).toMatch(/unreachable/);
    const busy = await fetchWithTimeout('https://example.org/', { fetchImpl: okFetch({}, 429), service: 'Open-Meteo' }).catch((e) => e);
    expect(busy.kind).toBe('http');
    expect(busy.status).toBe(429);
    expect(busy.message).toMatch(/rate limited/);
    const res = await fetchWithTimeout('https://example.org/', { fetchImpl: okFetch({}, 404), requireOk: false });
    expect(res.status).toBe(404);
  });

  it('honours the caller abort signal with kind "aborted"', async () => {
    const ctl = new AbortController();
    const p = fetchWithTimeout('https://example.org/', { fetchImpl: hangingFetch, timeoutMs: 5000, signal: ctl.signal }).catch((e) => e);
    ctl.abort();
    expect((await p).kind).toBe('aborted');
    ctl.abort();
    expect((await fetchWithTimeout('https://example.org/', { fetchImpl: hangingFetch, signal: ctl.signal }).catch((e) => e)).kind).toBe('aborted');
  });

  it('fetchJson rejects an unreadable body', async () => {
    const html: typeof fetch = async () => new Response('<html>captive portal</html>', { status: 200 });
    const err = await fetchJson('https://example.org/', { fetchImpl: html, service: 'X' }).catch((e) => e);
    expect(err).toBeInstanceOf(NetError);
    expect(err.message).toMatch(/unreadable/);
  });
});

describe('SoilGrids fallback', () => {
  it('fetchSoil times out instead of hanging, then skips SoilGrids for a while', async () => {
    vi.useFakeTimers();
    const p = fetchSoil(1.234, 5.678, { fetchImpl: hangingFetch }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(12_500);
    const err = await p;
    expect(err).toBeInstanceOf(NetError);
    expect(err.kind).toBe('timeout');
    vi.useRealTimers();
    // second farm right after: fails immediately instead of waiting another 12 s
    const quick = await fetchSoil(2.5, 6.5, { fetchImpl: hangingFetch }).catch((e) => e);
    expect(quick.kind).toBe('offline');
    expect(quick.message).toMatch(/SoilGrids offline/);
  });

  it('typical values per texture class use Saxton & Rawls; unknown falls back to loam', () => {
    const loam = typicalSoil('unknown');
    expect(loam.source).toBe('default');
    expect(loam.texture).toBe('loam');
    expect(loam.awcMmPerM).toBeCloseTo(saxtonRawlsAwc(42, 20, 2.5), 6);
    expect(loam.awcMmPerM).toBeGreaterThan(120);
    expect(loam.awcMmPerM).toBeLessThan(160);
    expect(loam.ph).toBeNull(); // no invented chemistry
    for (const t of Object.keys(TYPICAL_TEXTURE) as (keyof typeof TYPICAL_TEXTURE)[]) {
      const s = typicalSoil(t);
      expect(s.texture).toBe(t);
      expect(s.sandPct! + s.clayPct! + s.siltPct!).toBe(100);
    }
    expect(typicalSoil('sand').awcMmPerM).toBeLessThan(typicalSoil('silt-loam').awcMmPerM);
  });

  it('effectiveSoil without SoilGrids uses the farmer texture, else typical loam', () => {
    expect(effectiveSoil('unknown', null)).toEqual(typicalSoil('loam'));
    const farmer = effectiveSoil('sandy-loam', null);
    expect(farmer.source).toBe('farmer');
    expect(farmer.awcMmPerM).toBe(TEXTURE_AWC['sandy-loam']);
  });

  it('the engine produces a plan with the fallback soil', () => {
    const sc = structuredClone(DEMO_SENEGAL);
    const out = runEngine(sc, (bambey as any).series, effectiveSoil('unknown', null), detectPack(sc.location.lat, sc.location.lon));
    expect(out.allPlans.length).toBeGreaterThan(0);
    expect(out.prices.millet?.source).toBe('faostat-country');
  });
});
