// Field geometry for the onboarding map: geodesic polygon area and centroid. Points are [lat, lon] in degrees.

const R = 6_371_008.8; // mean Earth radius, m
const rad = (d: number) => (d * Math.PI) / 180;

/** Area of a simple polygon on the sphere, hectares (Chamberlain & Duquette 2007; ample for field-sized shapes). */
export function polygonAreaHa(pts: [number, number][]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [la1, lo1] = pts[i], [la2, lo2] = pts[(i + 1) % pts.length];
    s += rad(lo2 - lo1) * (2 + Math.sin(rad(la1)) + Math.sin(rad(la2)));
  }
  return Math.abs((s * R * R) / 2) / 10_000;
}

/** Area-weighted centroid in a local planar frame (fine for a field). */
export function polygonCentroid(pts: [number, number][]): [number, number] {
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const k = Math.cos(rad(lat0));
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [y1, x1] = pts[i], [y2, x2] = pts[(i + 1) % pts.length];
    const c = x1 * k * y2 - x2 * k * y1;
    a += c; cx += (x1 * k + x2 * k) * c; cy += (y1 + y2) * c;
  }
  if (Math.abs(a) < 1e-15) return [lat0, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  return [cy / (3 * a), cx / (3 * a * k)];
}

/** Keep at most `max` vertices (evenly spaced) so a boundary always fits in a share link. */
export function capVertices(pts: [number, number][], max = 40): [number, number][] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  return Array.from({ length: max }, (_, i) => pts[Math.floor(i * step)]);
}
