// Onboarding: field outline geometry and its round trip through share links and device storage.
import { describe, expect, it } from 'vitest';
import { capVertices, polygonAreaHa, polygonCentroid } from '../src/domain/geo';
import { decodeShare, encodeShare } from '../src/state/share';
import { sanitizeScenario } from '../src/state/shareCodec';
import { DEMO_SENEGAL } from '../src/state/demo';

// a 200 m × 100 m rectangle near Bambey (1 deg lat ≈ 111.2 km; lon scaled by cos(lat))
const lat0 = 14.7, lon0 = -16.46;
const dLat = 100 / 111_195, dLon = 200 / (111_195 * Math.cos((lat0 * Math.PI) / 180));
const rect: [number, number][] = [[lat0, lon0], [lat0, lon0 + dLon], [lat0 + dLat, lon0 + dLon], [lat0 + dLat, lon0]];

describe('field geometry', () => {
  it('area of a 200 m × 100 m field is 2 ha (±0.5 %), independent of vertex order', () => {
    expect(polygonAreaHa(rect)).toBeCloseTo(2, 1);
    expect(Math.abs(polygonAreaHa(rect) - 2)).toBeLessThan(0.01);
    expect(polygonAreaHa([...rect].reverse())).toBeCloseTo(polygonAreaHa(rect), 10);
    expect(polygonAreaHa(rect.slice(0, 2))).toBe(0);
  });
  it('centroid of the rectangle is its middle', () => {
    const [la, lo] = polygonCentroid(rect);
    expect(la).toBeCloseTo(lat0 + dLat / 2, 7);
    expect(lo).toBeCloseTo(lon0 + dLon / 2, 7);
  });
  it('long outlines are capped to 40 vertices', () => {
    const many = Array.from({ length: 300 }, (_, i) => [lat0 + Math.sin(i / 50) * 0.001, lon0 + Math.cos(i / 50) * 0.001] as [number, number]);
    expect(capVertices(many)).toHaveLength(40);
    expect(capVertices(rect)).toBe(rect);
  });
});

describe('field outline in links and saved farms', () => {
  const sc = { ...structuredClone(DEMO_SENEGAL), boundary: rect, area: 2, areaUnit: 'ha' as const };
  it('round-trips through a share link (5 decimals)', () => {
    const r = decodeShare(encodeShare(sc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scenario.boundary).toHaveLength(4);
    r.scenario.boundary!.forEach(([la, lo], i) => { expect(la).toBeCloseTo(rect[i][0], 5); expect(lo).toBeCloseTo(rect[i][1], 5); });
  });
  it('is kept for a farm stored on this device', () => {
    const r = sanitizeScenario(sc, { keepIds: true });
    expect(r.ok && r.scenario.boundary?.length).toBe(4);
  });
  it('a tampered outline with an impossible latitude is rejected; fewer than 3 points are dropped', () => {
    const bad = sanitizeScenario({ ...sc, boundary: [[95, 0], [0, 0], [0, 1]] });
    expect(bad.ok).toBe(false);
    const two = sanitizeScenario({ ...sc, boundary: rect.slice(0, 2) });
    expect(two.ok && two.scenario.boundary).toBeFalsy();
  });
  it('a link that would be too long drops the outline first and keeps the area', () => {
    const big = { ...sc, boundary: Array.from({ length: 40 }, (_, i) => [lat0 + i * 1e-5, lon0 + (i % 2) * 1e-5] as [number, number]) };
    const r = decodeShare(encodeShare(big, undefined, 600));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scenario.boundary ?? null).toBeNull();
    expect(r.scenario.area).toBe(2);
  });
});
