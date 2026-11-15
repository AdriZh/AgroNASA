// Deterministic animation helpers: every value is a pure function of time t (seconds),
// so the same frame can be rendered live in the browser or captured frame-by-frame for the MP4.
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeOut = (k: number) => 1 - (1 - k) ** 3;
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const easeBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };

/** Fade + rise entrance starting at `at`. */
export function enter(t: number, at: number, dur = 0.6, dy = 24): React.CSSProperties {
  const k = easeOut(prog(t, at, at + dur));
  return { opacity: k, transform: `translateY(${(1 - k) * dy}px)` };
}
/** Scale-pop entrance. */
export function pop(t: number, at: number, dur = 0.55): React.CSSProperties {
  const k = prog(t, at, at + dur);
  return { opacity: clamp(k * 2), transform: `scale(${lerp(0.6, 1, easeBack(k))})` };
}
/** Visibility envelope of a scene with crossfades. */
export function sceneAlpha(t: number, start: number, end: number, fade = 0.35) {
  if (t < start - fade || t > end + fade) return 0;
  return Math.min(prog(t, start - fade, start + fade * 0.2), 1 - prog(t, end - fade * 0.2, end + fade));
}
/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const fmtInt = (x: number) => Math.round(x).toLocaleString('en-US');
