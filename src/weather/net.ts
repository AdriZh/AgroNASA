// Shared network helpers: every external request gets a timeout and a readable error, so a slow or
// blocked network (hackathon Wi-Fi, captive portals, offline laptops) degrades to labelled fallbacks.

export type NetErrorKind = 'timeout' | 'offline' | 'http' | 'aborted';

export class NetError extends Error {
  readonly kind: NetErrorKind;
  readonly status?: number;
  readonly service: string;
  constructor(service: string, kind: NetErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'NetError';
    this.service = service;
    this.kind = kind;
    this.status = status;
  }
}

export interface FetchTimeoutOptions extends Omit<RequestInit, 'signal'> {
  /** Abort after this many milliseconds (default 10 s). */
  timeoutMs?: number;
  /** Caller's own cancellation signal; aborting it rejects with kind "aborted". */
  signal?: AbortSignal;
  /** Human name of the service, used in error messages ("NASA POWER"). */
  service?: string;
  /** Reject non-2xx responses with a NetError of kind "http" (default true). */
  requireOk?: boolean;
  /** Injected fetch implementation (tests). */
  fetchImpl?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * fetch() with an AbortController timeout. Rejects with a NetError whose kind says what went wrong:
 * "timeout" (no response in time), "offline" (DNS/connection/CORS failure), "http" (non-2xx), "aborted" (caller cancelled).
 */
export async function fetchWithTimeout(url: string, opts: FetchTimeoutOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, service = hostOf(url), requireOk = true, fetchImpl, ...init } = opts;
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new NetError(service, 'offline', `${service} unreachable (no fetch available)`);
  if (signal?.aborted) throw new NetError(service, 'aborted', `${service} request cancelled`);
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await doFetch(url, { ...init, signal: ctl.signal });
    if (requireOk && !res.ok) throw new NetError(service, 'http', httpMessage(service, res.status), res.status);
    return res;
  } catch (e: any) {
    if (e instanceof NetError) throw e;
    if (timedOut) throw new NetError(service, 'timeout', `${service} timed out after ${Math.round(timeoutMs / 1000)} s`);
    if (signal?.aborted || e?.name === 'AbortError') throw new NetError(service, 'aborted', `${service} request cancelled`);
    throw new NetError(service, 'offline', `${service} unreachable (offline or blocked network)`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** fetchWithTimeout + JSON parse; a malformed body is reported as an HTTP-kind error. */
export async function fetchJson<T = any>(url: string, opts: FetchTimeoutOptions = {}): Promise<T> {
  const res = await fetchWithTimeout(url, opts);
  try {
    return (await res.json()) as T;
  } catch {
    const service = opts.service ?? hostOf(url);
    throw new NetError(service, 'http', `${service} returned an unreadable response`, res.status);
  }
}

/** True for failures that will not fix themselves by retrying immediately (no network, timeout, cancel). */
export const isNetDown = (e: unknown) => e instanceof NetError && (e.kind === 'offline' || e.kind === 'timeout' || e.kind === 'aborted');

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function httpMessage(service: string, status: number): string {
  if (status === 429) return `${service} is busy (rate limited), try again in a minute`;
  if (status >= 500) return `${service} is temporarily down (HTTP ${status})`;
  return `${service} HTTP ${status}`;
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return 'network'; }
}
