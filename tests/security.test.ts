// Untrusted input: share links, imported files and device storage must be validated, size-limited and
// stripped of anything unexpected; external API payloads must never crash the app or inject links.
import { describe, expect, it } from 'vitest';
import type { FarmScenario } from '../src/domain/types';
import { decodeShare, encodeShare, sanitizeScenario, SHARE_MAX_TOKEN, MAX_AMOUNT } from '../src/state/share';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import { fetchEonet, safeHttpUrl } from '../src/weather/gibsPoint';
import { fetchForecast, geocode } from '../src/weather/forecast';
import { parsePower } from '../src/weather/power';
import { parseSoilGrids } from '../src/soil/soil';

const b64 = (o: unknown) => btoa(unescape(encodeURIComponent(typeof o === 'string' ? o : JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const MIN = { v: 1, n: 'x', l: [14.7, -16.4], a: [1, 'ha'], cu: 'XOF', b: [1000, 0], y: 2027, ir: ['no', 0], lb: 'high', f: '00', pr: 'cost' };
const norm = (x: unknown) => JSON.parse(JSON.stringify(x, (_k, v) => (v === null ? undefined : v)));

describe('share links: malicious input', () => {
  it('rejects a token over 8 kB without decoding it', () => {
    const r = decodeShare('A'.repeat(SHARE_MAX_TOKEN + 1));
    expect(r).toEqual({ ok: false, error: 'the link is too long' });
  });

  it('__proto__ / constructor keys do not pollute prototypes and are not copied', () => {
    const raw = `{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},${JSON.stringify(MIN).slice(1, -1)},"po":{"__proto__":{"polluted":1},"constructor":5,"millet:price":100}}`;
    const r = decodeShare(b64(raw));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(r.scenario.priceOverrides)).toBe(Object.prototype);
    expect(Object.keys(r.scenario.priceOverrides)).toEqual(['millet:price']);
    expect(Object.prototype.hasOwnProperty.call(r.scenario, 'constructor')).toBe(false);
  });

  it('strips unknown keys', () => {
    const r = decodeShare(b64({ ...MIN, evil: '<img src=x onerror=alert(1)>', onload: 'alert(1)' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.scenario)).not.toContain('evil');
  });

  it('crop ids that are Object.prototype keys are not treated as crops', () => {
    const r = decodeShare(b64({ ...MIN, h: [['constructor', 2025], ['__proto__', 2025], ['toString', 2025], ['millet', 2026]], ua: ['hasOwnProperty'], bo: ['constructor', 'millet'] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scenario.history.map((h) => h.cropId)).toEqual(['millet']);
    expect(r.scenario.unavailableCrops).toEqual([]);
    expect(r.scenario.baselineOverride).toBeNull();
  });

  it.each([
    ['name is an object', { n: { toString: 'x' } }],
    ['name is an array', { n: ['a'] }],
    ['latitude is a string', { l: ['14.7', 1] }],
    ['funds is a string', { b: ['1e9', 0] }],
    ['funds is NaN-ish', { b: [null, 0] }],
    ['area unit is unknown', { a: [1, 'furlong'] }],
    ['priority is javascript:', { pr: 'javascript:alert(1)' }],
    ['currency is markup', { cu: '<b>' }],
    ['history is an object', { h: { 0: ['millet', 2026] } }],
    ['fertilizer season index is fractional', { h: [['millet', 2026]], fz: [[0.5, 'urea', 'Urea', 0, null, 0, 50, 'kg']] }],
  ])('rejects wrong types (%s)', (_name, patch) => {
    expect(decodeShare(b64({ ...MIN, ...patch })).ok).toBe(false);
  });

  it('javascript: and markup strings stay inert text (rendered by React, never as URLs or HTML)', () => {
    const r = decodeShare(b64({ ...MIN, n: 'javascript:alert(1)//<script>alert(1)</script>', l: [14.7, -16.4, '<img src=x onerror=alert(1)>'] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(typeof r.scenario.name).toBe('string');
    expect(r.scenario.name).toBe('javascript:alert(1)//<script>alert(1)</script>');
    expect(typeof r.scenario.location.label).toBe('string');
  });

  it('clamps huge amounts, caps long strings and strips control characters', () => {
    const r = decodeShare(b64({ ...MIN, n: `a\u0000b‮c${'x'.repeat(500)}`, b: [1e300, 1e300], i: [['2027-01-01', 1e300, 'z'.repeat(999)]], po: { 'millet:price': 1e300 } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scenario.availableFunds).toBe(MAX_AMOUNT);
    expect(r.scenario.reserve).toBe(MAX_AMOUNT);
    expect(r.scenario.confirmedInflows[0].amount).toBe(MAX_AMOUNT);
    expect(r.scenario.confirmedInflows[0].label.length).toBe(120);
    expect(r.scenario.priceOverrides['millet:price']).toBe(MAX_AMOUNT);
    expect(r.scenario.name.startsWith('abc')).toBe(true);
    expect(r.scenario.name.length).toBe(120);
  });

  it('caps list lengths', () => {
    const h = Array.from({ length: 5000 }, (_, k) => ['millet', 1950 + (k % 200)]);
    const r = decodeShare(b64({ ...MIN, h, ua: Array(5000).fill('millet') }));
    // a real 5000-season token is far over 8 kB; this one is just under, the arrays are still capped
    if (r.ok) { expect(r.scenario.history.length).toBeLessThanOrEqual(200); expect(r.scenario.unavailableCrops.length).toBeLessThanOrEqual(60); }
    else expect(r.error).toMatch(/too long|invalid/);
  });
});

describe('imported files and device storage', () => {
  it.each([DEMO_SENEGAL, DEMO_KAZAKHSTAN].map((d) => [d.id, d] as const))('%s: a saved scenario survives validation unchanged', (_id, demo) => {
    const r = sanitizeScenario(JSON.parse(JSON.stringify(demo)), { keepIds: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(norm(r.scenario)).toEqual(norm(demo));
  });

  it('keeps the budget placeholder and exact coordinates; fills fields older versions did not save', () => {
    const old: any = JSON.parse(JSON.stringify({ ...DEMO_SENEGAL, location: { lat: 14.712345678, lon: -16.4, label: 'x' }, budgetPlaceholder: { funds: 1, reserve: 0, currency: 'XOF', key: 'k', usualCost: 2 } }));
    delete old.allowFallow; delete old.marketCrops;
    const r = sanitizeScenario(old, { keepIds: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scenario.location.lat).toBe(14.712345678);
    expect(r.scenario.budgetPlaceholder).toEqual({ funds: 1, reserve: 0, currency: 'XOF', key: 'k', usualCost: 2 });
    expect(r.scenario.allowFallow).toBe(false);
    expect(r.scenario.marketCrops).toEqual([]);
  });

  it.each([
    ['null', null],
    ['a string', 'scenario'],
    ['an array', [DEMO_SENEGAL]],
    ['no location', { ...DEMO_SENEGAL, location: undefined }],
    ['history is a string', { ...DEMO_SENEGAL, history: 'millet' }],
    ['history entry is a number', { ...DEMO_SENEGAL, history: [1] }],
    ['name is an object (would crash React)', { ...DEMO_SENEGAL, name: { a: 1 } }],
    ['area is a string', { ...DEMO_SENEGAL, area: '1' }],
    ['latitude out of range', { ...DEMO_SENEGAL, location: { lat: 1000, lon: 0 } }],
  ])('rejects a malformed file (%s) without throwing', (_name, raw) => {
    const r = sanitizeScenario(JSON.parse(JSON.stringify(raw ?? null)));
    expect(r.ok).toBe(false);
  });

  it('__proto__ in an imported file does not pollute and is not copied', () => {
    const text = JSON.stringify(DEMO_SENEGAL).replace(/^\{/, '{"__proto__":{"polluted":true},"isAdmin":true,');
    const r = sanitizeScenario(JSON.parse(text));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(({} as any).polluted).toBeUndefined();
    expect((r.scenario as any).polluted).toBeUndefined();
    expect((r.scenario as any).isAdmin).toBeUndefined();
  });

  it('re-encoding a sanitized scenario still makes a valid link', () => {
    const r = sanitizeScenario(structuredClone(DEMO_SENEGAL) as FarmScenario);
    expect(r.ok).toBe(true);
    if (r.ok) expect(decodeShare(encodeShare(r.scenario)).ok).toBe(true);
  });
});

describe('external API payloads', () => {
  const respond = (body: unknown) => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const withFetch = async <T,>(impl: typeof fetch, fn: () => Promise<T>) => {
    const prev = globalThis.fetch;
    globalThis.fetch = impl;
    try { return await fn(); } finally { globalThis.fetch = prev; }
  };

  it('only http(s) links are kept', () => {
    expect(safeHttpUrl('https://example.org/a')).toBe('https://example.org/a');
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl(' JAVASCRIPT:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeHttpUrl({ href: 'https://x' })).toBeUndefined();
  });

  it('EONET: javascript: links are dropped and malformed events are skipped', async () => {
    const events = await withFetch(respond({ events: [
      { id: 'a', title: 'Fire', categories: [{ title: 'Wildfires' }], sources: [{ url: 'javascript:alert(1)', id: 'x' }], link: 'javascript:alert(2)', geometry: [{ type: 'Point', date: '2026-01-01', coordinates: [-16.4, 14.7] }] },
      { id: 'b', title: { evil: 1 }, geometry: [{ type: 'Point', date: '2026-01-01', coordinates: ['x', 'y'] }] },
      { id: 'c', title: 'Flood', geometry: 'nope' },
      null,
    ] }), () => fetchEonet(14.7, -16.4));
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Fire');
    expect(events[0].link).toBeUndefined();
  });

  it('EONET: a non-object payload gives an empty list', async () => {
    expect(await withFetch(respond({ events: 'x' }), () => fetchEonet(14.7, -16.4))).toEqual([]);
    expect(await withFetch(respond([1, 2]), () => fetchEonet(14.7, -16.4))).toEqual([]);
  });

  it('Open-Meteo: wrong shapes are rejected or coerced, never crash', async () => {
    await expect(withFetch(respond({ daily: { time: 'x' } }), () => fetchForecast(1, 1))).rejects.toThrow();
    const f = await withFetch(respond({ daily: { time: ['2026-01-01', 5], precipitation_sum: ['a'], temperature_2m_max: [30], temperature_2m_min: [20] } }), () => fetchForecast(1, 1));
    expect(f.days).toHaveLength(1);
    expect(f.days[0]).toMatchObject({ date: '2026-01-01', rain: 0, tmax: 30, tmin: 20 });
  });

  it('Nominatim: non-string labels and bad coordinates are dropped', async () => {
    const hits = await withFetch(respond([{ display_name: { a: 1 }, lat: '1', lon: '2' }, { display_name: 'Dakar', lat: 'x', lon: '2' }, { display_name: 'Thiès', lat: '14.79', lon: '-16.93', address: { country_code: 'sn' } }]), () => geocode('x'));
    expect(hits).toEqual([{ label: 'Thiès', lat: 14.79, lon: -16.93, iso2: 'SN' }]);
  });

  it('NASA POWER: absurd date ranges and non-object parameters are rejected', () => {
    expect(() => parsePower({ properties: { parameter: { PRECTOTCORR: { '00010101': 1, '99991231': 1 } } } }, 'q', 'now', 'x')).toThrow();
    expect(() => parsePower({ properties: { parameter: { PRECTOTCORR: 'x' } } }, 'q', 'now', 'x')).toThrow();
    expect(() => parsePower({ properties: { parameter: 5 } }, 'q', 'now', 'x')).toThrow();
  });

  it('SoilGrids: wrong shapes give null instead of throwing', () => {
    expect(parseSoilGrids({ properties: { layers: 'x' } }, 'now')).toBeNull();
    expect(parseSoilGrids({ properties: { layers: [{ name: 'clay', depths: [{ label: '0-5cm', values: { mean: 'x' } }] }] } }, 'now')).toBeNull();
    expect(parseSoilGrids(null, 'now')).toBeNull();
  });
});
