// Minimal IndexedDB key/value store for cached public datasets (weather, soil). Falls back to memory.
const DB = 'field-shift';
const STORE = 'kv';
const mem = new Map<string, unknown>();

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Cached value for a key, or undefined. Cached entries are treated as untrusted (another tab, an older app
 * version or a corrupted store may have written them): pass `valid` to drop anything of the wrong shape.
 */
export async function idbGet<T>(key: string, valid?: (v: unknown) => boolean): Promise<T | undefined> {
  const check = (v: unknown) => (v === undefined || (valid && !valid(v)) ? undefined : (v as T));
  const db = await open();
  if (!db) return check(mem.get(key));
  return new Promise((resolve) => {
    try {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => { try { resolve(check(r.result)); } catch { resolve(undefined); } };
      r.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
/** Shape checks for the cached datasets (weather series, soil profile, GIBS point value). */
export const looksLikeSeries = (v: unknown) => isObj(v) && isObj(v.meta) && typeof v.meta.retrievedAt === 'string' && typeof v.meta.start === 'string'
  && typeof v.n === 'number' && v.n > 0 && ['P', 'TX', 'TN', 'T', 'RH', 'WS', 'RS'].every((k) => Array.isArray(v[k]) && v[k].length === v.n && v[k].every(isNumOrNull));
export const looksLikeSoil = (v: unknown) => isObj(v) && typeof v.texture === 'string' && typeof v.awcMmPerM === 'number' && Number.isFinite(v.awcMmPerM)
  && ['clayPct', 'sandPct', 'siltPct', 'socPct', 'ph'].every((k) => v[k] === undefined || isNumOrNull(v[k]));
export const looksLikePoint = (v: unknown) => isObj(v) && typeof v.date === 'string' && isNumOrNull(v.value) && (v.label === undefined || typeof v.label === 'string');

export async function idbSet(key: string, value: unknown): Promise<void> {
  mem.set(key, value);
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbClear(): Promise<void> {
  mem.clear();
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
