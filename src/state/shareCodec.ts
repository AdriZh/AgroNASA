// Share-link codec and scenario validator (no React, no app state), so AppContext can validate stored and
// imported scenarios without an import cycle through share.ts. See share.ts for the link format.
import type { FarmScenario } from '../domain/types';
import { CROPS } from '../data/crops';
import { packById } from '../data/regionPacks';
import { normalizeWhatIf, WHATIF_NONE, type WhatIf } from '../engine/whatif';

export const SHARE_VERSION = 1;
export const SHARE_MAX_URL = 2000;

// ---------- base64url of UTF-8 ----------
function toB64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(token: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('not base64url');
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// ---------- compact form ----------
// Positional arrays keep the link short. ids are dropped and regenerated; fertilizer refers to its crop
// season by index into the history list.
type Compact = {
  v: number;
  n: string; p?: string; l: [number, number, string?]; c?: string;
  a: [number, string]; cu: string; b: [number, number]; i?: [string, number, string][]; y: number;
  ir: [string, number]; lb: string; ua?: string[]; mc?: string[]; f: string; pr: string; bo?: [string, string];
  h?: (string | number | null)[][]; fz?: (string | number | null)[][];
  so?: [string, number?, number?]; po?: Record<string, number | null>; sy?: 1; w?: [number, number];
};

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
const flags = (sc: FarmScenario) => `${sc.needsResidue ? 1 : 0}${sc.allowFallow ? 1 : 0}`;

type Detail = { fertilizer: boolean; notes: boolean; historyMax?: number };
function compact(sc: FarmScenario, w: WhatIf, opts: Detail): Compact {
  const hIdx = new Map(sc.history.map((h, k) => [h.id, k]));
  const c: Compact = {
    v: SHARE_VERSION, n: sc.name, l: [round(sc.location.lat, 4), round(sc.location.lon, 4)],
    a: [sc.area, sc.areaUnit], cu: sc.currency, b: [sc.availableFunds, sc.reserve], y: sc.firstSeasonYear,
    ir: [sc.irrigation, sc.irrigationCapacityMm || 0], lb: sc.laborAvailable, f: flags(sc), pr: sc.priority,
  };
  if (sc.location.label) c.l[2] = sc.location.label;
  if (sc.regionPackId) c.p = sc.regionPackId;
  if (sc.countryIso2) c.c = sc.countryIso2;
  if (sc.confirmedInflows.length) c.i = sc.confirmedInflows.map((x) => [x.date, x.amount, x.label]);
  if (sc.unavailableCrops.length) c.ua = sc.unavailableCrops;
  if (sc.marketCrops.length) c.mc = sc.marketCrops;
  if (sc.baselineOverride) c.bo = sc.baselineOverride;
  if (sc.history.length) {
    const recent = opts.historyMax == null ? sc.history : [...sc.history].sort((x, y) => y.year - x.year).slice(0, opts.historyMax);
    c.h = sc.history.filter((h) => recent.includes(h)).map((h) => trim([h.cropId, h.year, h.seasonId ?? null, h.plantedOn ?? null, h.harvestedOn ?? null, h.approximateDate ? 1 : 0, h.outcome ?? null, h.residueUse ?? null, h.yieldTHa ?? null, opts.notes ? h.notes ?? null : null]));
  }
  if (opts.fertilizer && sc.fertilizer.length) {
    c.fz = sc.fertilizer.map((f) => trim([hIdx.get(f.cropSeasonId) ?? -1, f.productId, f.productName, f.type === 'organic' ? 1 : 0, f.applicationDate ?? null, f.approximateDate ? 1 : 0, f.quantity, f.quantityUnit, f.bagMassKg ?? null, f.treatedAreaHa ?? null, f.n ?? null, f.p2o5 ?? null, f.k2o ?? null, f.paidCost ?? null, f.source, f.currency ?? null, f.method ?? null]));
  }
  const so = sc.soil;
  if (so.texture !== 'unknown' || so.labPh != null || so.labSocPct != null) c.so = [so.texture, ...(so.labPh != null || so.labSocPct != null ? [so.labPh ?? undefined, so.labSocPct ?? undefined] : [])] as Compact['so'];
  if (Object.keys(sc.priceOverrides).length) c.po = sc.priceOverrides;
  if (sc.synthetic) c.sy = 1;
  const wn = normalizeWhatIf(w);
  if (wn.rainScale !== 1 || wn.dT !== 0) c.w = [wn.rainScale, wn.dT];
  return c;
}
/** Drop trailing nulls of a positional record. */
function trim<T>(a: (T | null)[]): (T | null)[] { let n = a.length; while (n > 0 && a[n - 1] == null) n--; return a.slice(0, n); }

/** Encode a scenario (+ what-if) into a URL-safe token. Drops history notes, then fertilizer, then old seasons if the link would be too long. */
export function encodeShare(sc: FarmScenario, w: WhatIf = WHATIF_NONE, budget = SHARE_MAX_URL - 120): string {
  // the engine only reads the last few seasons of history, so very long histories degrade gracefully
  const tries: Detail[] = [{ fertilizer: true, notes: true }, { fertilizer: true, notes: false }, { fertilizer: false, notes: false }, { fertilizer: false, notes: false, historyMax: 8 }, { fertilizer: false, notes: false, historyMax: 4 }];
  let token = '';
  for (const o of tries) { token = toB64url(JSON.stringify(compact(sc, w, o))); if (token.length <= budget) break; }
  return token;
}

export function shareUrl(sc: FarmScenario, w: WhatIf, base?: string): string {
  const origin = base ?? (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}${window.location.search}` : '');
  return `${origin}#/compare?s=${encodeShare(sc, w)}`;
}

/** The share token in a location hash such as "#/compare?s=…", or null when there is none. */
export function tokenFromHash(hash: string): string | null {
  const q = hash.indexOf('?');
  if (q < 0) return null;
  try { return new URLSearchParams(hash.slice(q + 1)).get('s'); } catch { return null; }
}

// ---------- decode + validate ----------
// Everything decoded from a link, an imported file or device storage is untrusted. The validator builds a
// brand-new object field by field, so unknown keys (including "__proto__" / "constructor") are never copied;
// every value is type-checked, strings are length-capped and stripped of control characters, lists are capped,
// open-ended amounts are clamped to a sane range and crop / region ids must be known own keys.
export type DecodeResult = { ok: true; scenario: FarmScenario; whatIf: WhatIf } | { ok: false; error: string };

/** Longest share token accepted (8 kB); real links are kept under SHARE_MAX_URL. */
export const SHARE_MAX_TOKEN = 8192;
/** Largest amount accepted for money, quantities and prices (anything bigger is clamped). */
export const MAX_AMOUNT = 1e13;

class Bad extends Error {}
const fail = (what: string): never => { throw new Bad(what); };
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const hasCrop = (c: unknown): c is string => typeof c === 'string' && own(CROPS, c);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const num = (x: unknown, what: string, min = -Infinity, max = Infinity) => (isNum(x) && x >= min && x <= max ? x : fail(what));
const optNum = (x: unknown, what: string, min = -Infinity, max = Infinity) => (x == null ? null : num(x, what, min, max));
/** A finite number of the right type, clamped into [min, max] (for open-ended amounts). */
const amount = (x: unknown, what: string, min = 0, max = MAX_AMOUNT) => (isNum(x) ? Math.min(max, Math.max(min, x)) : fail(what));
const optAmount = (x: unknown, what: string, min = 0, max = MAX_AMOUNT) => (x == null ? null : amount(x, what, min, max));
// C0/C1 control characters (except tab and newline) and bidi overrides are removed; over-long text is cut.
// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;
const str = (x: unknown, what: string, maxLen = 200) => (typeof x === 'string' ? x.replace(CTRL, '').slice(0, maxLen) : fail(what));
const optStr = (x: unknown, what: string, maxLen = 200) => (x == null ? undefined : str(x, what, maxLen));
const oneOf = <T extends string>(x: unknown, opts: readonly T[], what: string): T => (opts.includes(x as T) ? (x as T) : fail(what));
const isoDate = (x: unknown, what: string) => (x == null ? undefined : typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : fail(what));
const arr = (x: unknown, what: string, max = 60): unknown[] => (Array.isArray(x) ? x.slice(0, max) : fail(what));
const crops = (x: unknown, what: string) => (x == null ? [] : arr(x, what).map((c) => str(c, what)).filter(hasCrop));
const PRICE_KEY = /^[A-Za-z0-9_.-]{1,40}:[A-Za-z0-9_.-]{1,40}$/;
const id = (x: unknown, fallback: string) => (typeof x === 'string' && x.length > 0 && x.length <= 80 ? x : fallback);

/** Original ids to keep (device storage); links and imports get fresh positional ids. */
type Ids = { id?: unknown; h?: unknown[]; f?: unknown[]; i?: unknown[] };

function validate(c: any, ids: Ids = {}): { scenario: FarmScenario; whatIf: WhatIf } {
  if (!c || typeof c !== 'object' || Array.isArray(c)) fail('not a scenario');
  if (c.v !== SHARE_VERSION) fail(`unsupported link version ${String(c.v).slice(0, 20)}`);
  const l = arr(c.l, 'location', 3);
  const a = arr(c.a, 'area', 2);
  const b = arr(c.b, 'budget', 2);
  const ir = arr(c.ir, 'irrigation', 2);
  const fl = str(c.f, 'flags', 2);
  const history = (c.h == null ? [] : arr(c.h, 'history', 200)).map((r, k) => {
    const h = arr(r, 'history entry', 10);
    const cropId = str(h[0], 'history crop', 60);
    return {
      id: id(ids.h?.[k], `h${k + 1}`), cropId, year: num(h[1], 'history year', 1900, 2200), seasonId: optStr(h[2], 'history season', 40),
      plantedOn: isoDate(h[3], 'planting date'), harvestedOn: isoDate(h[4], 'harvest date'), approximateDate: h[5] === 1,
      outcome: h[6] == null ? undefined : oneOf(h[6], ['good', 'average', 'poor', 'failed', 'unknown'] as const, 'history outcome'),
      residueUse: h[7] == null ? undefined : oneOf(h[7], ['left', 'grazed', 'removed', 'burned', 'unknown'] as const, 'residue use'),
      yieldTHa: optNum(h[8], 'history yield', 0, 100), notes: optStr(h[9], 'history notes', 500),
    } as FarmScenario['history'][number];
  });
  const fertilizer = (c.fz == null ? [] : arr(c.fz, 'fertilizer', 200)).map((r, k) => {
    const f = arr(r, 'fertilizer entry', 17);
    const hi = num(f[0], 'fertilizer season', -1, history.length - 1);
    if (!Number.isInteger(hi)) fail('fertilizer season');
    return {
      id: id(ids.f?.[k], `f${k + 1}`), cropSeasonId: hi >= 0 ? history[hi].id : '', productId: str(f[1], 'fertilizer product', 60), productName: str(f[2], 'fertilizer name', 120),
      type: f[3] === 1 ? 'organic' : 'mineral', applicationDate: isoDate(f[4], 'application date'), approximateDate: f[5] === 1,
      quantity: optAmount(f[6], 'fertilizer quantity'), quantityUnit: oneOf(f[7], ['kg', 'bag', 't', 'L'] as const, 'fertilizer unit'),
      bagMassKg: optAmount(f[8], 'bag mass', 0, 10_000), treatedAreaHa: optAmount(f[9], 'treated area', 0, 1e7), n: optNum(f[10], 'N %', 0, 100), p2o5: optNum(f[11], 'P2O5 %', 0, 100), k2o: optNum(f[12], 'K2O %', 0, 100),
      paidCost: optAmount(f[13], 'fertilizer cost'), source: f[14] == null ? 'unknown' : oneOf(f[14], ['receipt', 'recall', 'unknown'] as const, 'fertilizer source'),
      currency: optStr(f[15], 'fertilizer currency', 3), method: optStr(f[16], 'fertilizer method', 80),
    } as FarmScenario['fertilizer'][number];
  });
  const so = c.so == null ? [] : arr(c.so, 'soil', 3);
  const po: Record<string, number | null> = {};
  if (c.po != null) {
    if (typeof c.po !== 'object' || Array.isArray(c.po)) fail('price overrides');
    // keys look like "millet:price"; anything else ("__proto__", "constructor", junk) is dropped
    for (const [k, v] of Object.entries(c.po).slice(0, 500)) { if (PRICE_KEY.test(k)) po[k] = optAmount(v, 'price override'); }
  }
  const bo = c.bo == null ? null : arr(c.bo, 'usual plan', 2).map((x) => str(x, 'usual plan', 60));
  const iso2 = optStr(c.c, 'country', 2);
  const pack = optStr(c.p, 'region pack', 40);
  const currency = str(c.cu, 'currency', 3);
  if (!/^[A-Z]{3}$/.test(currency)) fail('currency');
  const scenario: FarmScenario = {
    id: id(ids.id, 'shared'), name: str(c.n, 'name', 120) || 'Shared farm',
    regionPackId: pack && packById(pack) ? pack : undefined,
    location: { lat: num(l[0], 'latitude', -90, 90), lon: num(l[1], 'longitude', -180, 180), label: optStr(l[2], 'place name', 160) },
    countryIso2: iso2 && /^[A-Z]{2}$/.test(iso2) ? iso2 : undefined,
    area: num(a[0], 'area', 1e-6, 1e9), areaUnit: oneOf(a[1], ['ha', 'acre', 'm2'] as const, 'area unit'),
    currency, availableFunds: amount(b[0], 'funds'), reserve: amount(b[1], 'reserve'),
    confirmedInflows: (c.i == null ? [] : arr(c.i, 'inflows', 30)).map((r, k) => { const x = arr(r, 'inflow', 3); return { id: id(ids.i?.[k], `i${k + 1}`), date: isoDate(x[0], 'inflow date') ?? fail('inflow date'), amount: amount(x[1], 'inflow amount'), label: str(x[2], 'inflow label', 120) }; }),
    firstSeasonYear: num(c.y, 'first season year', 1990, 2200),
    irrigation: oneOf(ir[0], ['yes', 'no', 'unknown'] as const, 'irrigation'), irrigationCapacityMm: amount(ir[1] ?? 0, 'irrigation capacity', 0, 5000),
    laborAvailable: oneOf(c.lb, ['low', 'medium', 'high'] as const, 'labor'),
    unavailableCrops: crops(c.ua, 'unavailable crops'), marketCrops: crops(c.mc, 'market crops'),
    needsResidue: fl[0] === '1', allowFallow: fl[1] === '1',
    priority: oneOf(c.pr, ['cost', 'climate', 'continuity', 'return'] as const, 'priority'),
    baselineOverride: bo && bo.length === 2 && bo.every(hasCrop) ? [bo[0], bo[1]] : null,
    history: history.filter((h) => hasCrop(h.cropId)),
    fertilizer: fertilizer.filter((f) => !f.cropSeasonId || history.some((h) => h.id === f.cropSeasonId && hasCrop(h.cropId))),
    soil: {
      texture: so[0] == null ? 'unknown' : oneOf(so[0], ['sand', 'loamy-sand', 'sandy-loam', 'loam', 'silt-loam', 'clay-loam', 'clay', 'unknown'] as const, 'soil texture'),
      labPh: optNum(so[1], 'soil pH', 2, 12), labSocPct: optNum(so[2], 'soil organic carbon', 0, 100),
    },
    priceOverrides: po, synthetic: c.sy === 1,
  };
  // what-if values are clamped to the slider range rather than rejected
  const w = c.w == null ? WHATIF_NONE : (() => { const x = arr(c.w, 'what-if', 2); return normalizeWhatIf({ rainScale: num(x[0], 'rain change'), dT: num(x[1], 'temperature change') }); })();
  return { scenario, whatIf: w };
}

/** Decode a share token. Never throws: malformed, truncated, oversized or tampered links come back as { ok: false }. */
export function decodeShare(token: string | null | undefined): DecodeResult {
  if (!token || typeof token !== 'string') return { ok: false, error: 'the link has no scenario in it' };
  if (token.length > SHARE_MAX_TOKEN) return { ok: false, error: 'the link is too long' };
  try {
    const parsed = JSON.parse(fromB64url(token));
    return { ok: true, ...validate(parsed) };
  } catch (e) {
    return { ok: false, error: e instanceof Bad ? `invalid ${e.message}` : 'the link looks incomplete or damaged' };
  }
}

export type SanitizeResult = { ok: true; scenario: FarmScenario } | { ok: false; error: string };

/** Fields a scenario saved by an older version may lack, with the value the app has always assumed. */
const DEFAULTS = {
  confirmedInflows: [], unavailableCrops: [], marketCrops: [], history: [], fertilizer: [], priceOverrides: {},
  soil: { texture: 'unknown' }, needsResidue: false, allowFallow: false, synthetic: false, irrigation: 'unknown', irrigationCapacityMm: 0,
  laborAvailable: 'medium', priority: 'cost', baselineOverride: null, firstSeasonYear: new Date().getFullYear() + 1, reserve: 0,
} as const;

function placeholder(x: unknown): FarmScenario['budgetPlaceholder'] {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const p = x as Record<string, unknown>;
  if (!isNum(p.funds) || !isNum(p.reserve) || !isNum(p.usualCost) || typeof p.currency !== 'string' || !/^[A-Z]{3}$/.test(p.currency) || typeof p.key !== 'string') return null;
  return { funds: amount(p.funds, 'placeholder'), reserve: amount(p.reserve, 'placeholder'), usualCost: amount(p.usualCost, 'placeholder'), currency: p.currency, key: p.key.slice(0, 400) };
}

/**
 * Validate a full scenario object from an imported file or device storage with the same rules as a share link
 * (it goes through the compact form). Never throws. `keepIds` keeps the scenario's own ids (device storage).
 */
export function sanitizeScenario(raw: unknown, opts: { keepIds?: boolean } = {}): SanitizeResult {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('scenario');
    const r = raw as Record<string, unknown>;
    const src: Record<string, unknown> = {};
    for (const k of Object.keys(r)) if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') src[k] = r[k];
    for (const [k, v] of Object.entries(DEFAULTS)) if (src[k] == null && !(k === 'baselineOverride' && k in src)) src[k] = structuredClone(v);
    if (!src.location || typeof src.location !== 'object') fail('location');
    for (const k of ['history', 'fertilizer', 'confirmedInflows', 'unavailableCrops', 'marketCrops'] as const) if (!Array.isArray(src[k])) fail(k);
    for (const k of ['history', 'fertilizer', 'confirmedInflows'] as const) if (!(src[k] as unknown[]).every((e) => e && typeof e === 'object' && !Array.isArray(e))) fail(k);
    if (typeof src.soil !== 'object' || typeof src.priceOverrides !== 'object') fail('soil or prices');
    const sc = src as unknown as FarmScenario;
    const c = compact(sc, WHATIF_NONE, { fertilizer: true, notes: true });
    const ids: Ids = opts.keepIds ? { id: sc.id, h: sc.history.map((h) => h.id), f: sc.fertilizer.map((f) => f.id), i: sc.confirmedInflows.map((x) => x.id) } : {};
    // compact() reads values without checking them; the JSON round trip drops anything that is not plain data
    const { scenario } = validate(JSON.parse(JSON.stringify(c)), ids);
    const out: FarmScenario = { ...scenario };
    // links round coordinates to 4 decimals; a stored or imported farm keeps its exact (already range-checked) point
    const { lat, lon } = sc.location as { lat: unknown; lon: unknown };
    if (isNum(lat) && isNum(lon)) out.location = { ...scenario.location, lat, lon };
    const bp = placeholder(sc.budgetPlaceholder);
    if (bp) out.budgetPlaceholder = bp;
    return { ok: true, scenario: out };
  } catch (e) {
    return { ok: false, error: e instanceof Bad ? `invalid ${e.message}` : 'not a Field Shift scenario' };
  }
}

/** Content equality that ignores ids (used to reopen an existing scenario instead of duplicating it). */
export function sameScenario(a: FarmScenario, b: FarmScenario): boolean {
  return encodeShare(a, WHATIF_NONE, Infinity) === encodeShare(b, WHATIF_NONE, Infinity);
}

