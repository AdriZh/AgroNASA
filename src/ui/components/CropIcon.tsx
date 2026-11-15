import type { ReactNode } from 'react';
import { CROPS, cropName } from '../../data/crops';

/*
 * One small line glyph per crop on a 20 × 20 grid, 1.5 px stroke, round caps, drawn in the crop group's colour
 * on a soft chip (tokens --crop-<group> / --crop-<group>-soft in styles.css). Unknown ids (e.g. crops added
 * later) get a generic leaf in their group's colour, so new entries render without changes here.
 */

type Group = 'cereal' | 'legume' | 'oilseed' | 'tuber' | 'fallow' | 'cover';

/** A grain on an ear: a lens from the stem at (10, y) out to one side (dx = ±1). */
const grain = (y: number, dx: number, w = 2.4, h = 2.8) =>
  `M10 ${y}Q${10 + dx * 0.4} ${y - h * 0.85} ${10 + dx * w} ${y - h}Q${10 + dx * w * 0.9} ${y - h * 0.15} 10 ${y}Z`;
const grains = (ys: number[], w?: number, h?: number) => ys.flatMap((y) => [grain(y, -1, w, h), grain(y, 1, w, h)]).join('');

/** Scalloped flower outline: n lobes of radius r around (cx, cy), each bulging by `bulge`. */
function flower(cx: number, cy: number, r: number, n: number, bulge: number, rot = -90) {
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const a = ((rot + (360 / n) * (i + 0.5)) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)].map((v) => +v.toFixed(2));
  });
  return `M${pts[0][0]} ${pts[0][1]}` + pts.slice(1).map(([x, y]) => `A${bulge} ${bulge} 0 0 1 ${x} ${y}`).join('');
}

/** Small snow mark for winter-sown crops, top-right corner. */
const snow = <path d="M16.5 1.8v4.4M14.6 2.9l3.8 2.2M14.6 5.1l3.8-2.2" strokeWidth={1.1} />;

const LEAF = <><path d="M4 16C4 9 9 4 16 4c0 7-5 12-12 12Z" /><path d="M4 16 11 9" /></>;

const G: Record<string, ReactNode> = {
  // ---- cereals
  wheat: <><path d="M10 18.5V5.5" /><path d={grains([15, 11.5, 8], 2.7, 2.3)} /><path d="M10 5.6Q8.8 3.9 10 1.8Q11.2 3.9 10 5.6Z" /></>,
  winterwheat: <><g transform="translate(-1.8 0)"><path d="M10 18.5V5.5" /><path d={grains([15, 11.5, 8], 2.7, 2.3)} /><path d="M10 5.6Q8.8 3.9 10 1.8Q11.2 3.9 10 5.6Z" /></g>{snow}</>,
  barley: <><path d="M10 18.5V8.5" /><path d={grains([16, 13, 10], 1.9, 2.5)} /><path d="M8.1 7.5 5.6 1.5M10 8V1M11.9 7.5l2.5-6" /></>,
  oats: <><path d="M10 18.5V2" /><path d="M10 5.5 6 7.2M10 5.5l4 1.7M10 10l-4.5 1.6M10 10l4.5 1.6" /><path d="M6 7.2Q4.9 8.8 6 10.6Q7.1 8.8 6 7.2ZM14 7.2Q12.9 8.8 14 10.6Q15.1 8.8 14 7.2ZM5.5 11.6Q4.4 13.2 5.5 15Q6.6 13.2 5.5 11.6ZM14.5 11.6Q13.4 13.2 14.5 15Q15.6 13.2 14.5 11.6Z" /></>,
  millet: <><path d="M10 18.5V13" /><rect x="7.9" y="1.5" width="4.2" height="11.5" rx="2.1" /><path d="M7.9 5.3h4.2M7.9 9.1h4.2" /><path d="M10 16.5c2-.3 3.6-1.4 4.6-3" /></>,
  sorghum: <><path d="M10 18.5V10.5" /><circle cx="10" cy="3.3" r="1.7" /><circle cx="7" cy="6.2" r="1.7" /><circle cx="13" cy="6.2" r="1.7" /><circle cx="10" cy="8.8" r="1.7" /><path d="M10 15.5c-2-.2-3.7-1.3-4.7-2.9" /></>,
  maize: <><path d="M10 1.8c1.9 0 3 2.2 3 5.6S11.9 14 10 14 7 10.8 7 7.4 8.1 1.8 10 1.8Z" /><path d="M10 2.5V13.5M7.3 6h5.4M7.3 9.4h5.4" /><path d="M10 18.5C6.5 17.5 4.5 14 4.3 8.5M10 18.5c3.5-1 5.5-4.5 5.7-10" /></>,
  rice: <><path d="M5 18.5C5 10 7.5 4 12.5 3.2c2.6-.4 3.6 1.5 3.2 4" /><path d="M11.7 5.6Q10.3 6.8 10.7 8.8Q12.3 7.6 11.7 5.6ZM15.7 7.2Q14.3 8.3 14.7 10.3Q16.3 9.2 15.7 7.2ZM14 3.3Q12.8 4.6 13.3 6.5Q14.7 5.2 14 3.3Z" /></>,
  teff: <><path d="M10 18.5V2.5" /><path d="M10 5.5 6.5 2.8M10 5.5l3.5-2.7M10 8.5 5.2 5.8M10 8.5l4.8-2.7M10 11.5 5.5 9.5M10 11.5l4.5-2" /><path d="M6.5 2.8 5.7 2.2M13.5 2.8l.8-.6M5.2 5.8l-.9-.5M14.8 5.8l.9-.5" /></>,
  // ---- legumes
  groundnut: <><path d="M7.2 2.5c2.3 0 3.8 1.7 3.8 3.9 0 1 .6 1.7 1.6 2.3 1.8 1 2.9 2.4 2.9 4.5 0 2.6-2 4.3-4.6 4.3-2.4 0-4-1.5-4-3.6 0-1-.5-1.7-1.6-2.4C3.6 10.4 3 9 3 7.2c0-2.7 1.7-4.7 4.2-4.7Z" /><path d="M6 5.2 8 7M11 12l2.1 1.8" /></>,
  cowpea: <><path d="M2.5 16.5C7 15.5 12.5 11 16.5 3.5c.8 1 .5 2.2-.2 3.4C13 12.5 8 17 2.5 16.5Z" /><circle cx="9.5" cy="12" r=".9" fill="currentColor" stroke="none" /></>,
  bean: <><path d="M6.3 3.8c2.4-1.3 5.4-.5 6.6 1.6.6 1 .5 2 1.5 2.7 1.7 1.2 2.3 3.6 1.2 5.6-1.5 2.7-5.2 3.7-8.6 2.3C3.3 14.5 2 10.5 3.2 7.4c.6-1.6 1.6-2.8 3.1-3.6Z" /><path d="M11 9.3c-.9.5-1.6.4-2.2-.3" /></>,
  lentil: <><ellipse cx="6.2" cy="12.6" rx="3.9" ry="2.7" transform="rotate(-15 6.2 12.6)" /><ellipse cx="13.8" cy="7.4" rx="3.9" ry="2.7" transform="rotate(-15 13.8 7.4)" /><path d="M3.8 12.9h4.8M11.4 7.7h4.8" strokeWidth={1} /></>,
  chickpea: <><path d="M10 4.2c3.6 0 6.3 2.8 6.3 6.3S13.6 17 10 17s-6.3-3-6.3-6.5c0-2.2 1-4.2 2.7-5.3" /><path d="M6.4 5.2 5 2.8l3.2 1.6" /><path d="M10 7.2c-1.4 1.5-1.4 4.4 0 6.4" /></>,
  soybean: <><path d="M3 15.5c.8-1.8 2.6-2 3.3-3.4.8-1.6.4-3.3 1.8-4.6 1.5-1.4 3.6-.8 4.9-2.2 1.2-1.3 1.3-2.7 3.5-3 .8 2.2-.2 3.7-1.5 4.8-1.4 1.2-1.4 3.3-2.9 4.6-1.4 1.3-3.4 1-4.8 2.2-1.4 1.2-1.5 2.8-3.5 3.3-.5-.6-.9-1.1-.8-1.7Z" /><path d="M6.3 13.4l.5.5M9.6 10l.5.5M12.9 6.6l.5.5" /></>,
  pea: <><path d="M2.5 15C5 8.5 10.5 4 17.5 3.5 16 10 10.5 15 2.5 15Z" /><circle cx="7.4" cy="11.6" r="1.5" /><circle cx="10.6" cy="9.2" r="1.5" /><circle cx="13.7" cy="6.7" r="1.5" /></>,
  fababean: <><path d="M4.2 17.5c-1.6-1.6-1.4-4 .4-5.8l7.2-7.2c1.8-1.8 4.2-2 5.8-.4s1.4 4-.4 5.8l-7.2 7.2c-1.8 1.8-4.2 2-5.8.4Z" /><ellipse cx="7" cy="14.2" rx="1.9" ry="1.3" transform="rotate(-45 7 14.2)" /><ellipse cx="13.3" cy="7.9" rx="1.9" ry="1.3" transform="rotate(-45 13.3 7.9)" /><path d="M17.4 3.8 18.8 2.4" /></>,
  pigeonpea: <><path d="M3 14.5 12.8 4.7c1.4-1.4 3.4-1.6 4.4-.6s.8 3-.6 4.4L6.8 18.3c-1.4 1.4-3.2 1.4-4 .6s-.6-2.6.2-4.4Z" /><path d="M6.6 12.8l1.9 1.9M9.5 9.9l1.9 1.9M12.4 7l1.9 1.9" /></>,
  // ---- oilseeds and fibre
  sesame: <><path d="M10 18.5V15" /><path d="M10 1.5c1.8 1.2 2.9 3 2.9 5.5v4.5c0 2-1.3 3.5-2.9 3.5S7.1 13.5 7.1 11.5V7c0-2.5 1.1-4.3 2.9-5.5Z" /><path d="M10 3.5V14.5" /><path d="M10 17c1.7-.2 3.3-1.1 4.3-2.6" /></>,
  sunflower: <><path d={flower(10, 8.2, 5.8, 10, 1.6)} /><circle cx="10" cy="8.2" r="2.5" /><path d="M10 14.2v4.3M10 17c1.6-.3 2.8-1.2 3.4-2.4" /></>,
  flax: <><path d={flower(10, 8, 4.4, 5, 2.7)} /><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" /><path d="M10 13.5v5" /></>,
  rapeseed: <><path d={flower(10, 5.5, 3.4, 4, 1.9, -45)} /><path d="M10 9v9.5M10 12.5l-4.6-1.2M10 15.5l4.6-1.2" /><path d="M5.4 11.3 3 10.7M14.6 14.3l2.4-.6" /></>,
  winterrapeseed: <><path d={flower(8.5, 6, 3.4, 4, 1.9, -45)} /><path d="M8.5 9.5v9M8.5 13.5l-3.5-2M8.5 15.8l3.5-2" />{snow}</>,
  mustard: <><path d={flower(7, 5, 2.6, 4, 1.5, -45)} /><path d={flower(13.5, 7.5, 2.6, 4, 1.5, -45)} /><path d="M7 7.8C7 12 8.5 15 10 18.5M13.5 10.3c0 3-1.5 5.5-3.5 8.2" /></>,
  cotton: <><path d="M6 11.2C3.6 11 2.6 9.2 3 7.5c.4-1.6 2-2.4 3.4-2 .3-2 1.9-3.3 3.6-3.3s3.3 1.3 3.6 3.3c1.4-.4 3 .4 3.4 2 .4 1.7-.6 3.5-3 3.7" /><path d="M10 5.5v4" /><path d="M5 11.5 10 14l5-2.5M10 14v4.5" /></>,
  // ---- tuber
  potato: <><path d="M4.5 6.8C6 4 9.4 3.4 12.6 4.2c3.2.8 4.9 3.3 4.3 6.4-.6 3-3.4 5.4-7 5.2-3.2-.2-6.6-1.6-7-4.4-.2-1.6.7-3.3 1.6-4.6Z" /><path d="M8 7.6l.4.4M12.8 7.4l.4.4M10.8 12.2l.4.4" /></>,
  // ---- fallow
  fallow: <><path d="M2 8.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 2.5 1 2.5 1" /><path d="M2 12.5h16M4 16.5h12" /></>,
};

const GROUP_FALLBACK: Record<Group, ReactNode> = {
  cereal: LEAF, legume: LEAF, oilseed: LEAF, tuber: LEAF, cover: LEAF, fallow: G.fallow,
};

export function cropGroup(id: string): Group {
  const g = (CROPS[id] as { group?: string } | undefined)?.group;
  return (g === 'cereal' || g === 'legume' || g === 'oilseed' || g === 'tuber' || g === 'fallow' || g === 'cover') ? g : 'cover';
}

/**
 * Inline crop glyph on a group-coloured chip. `size` is the chip edge in px (default 20; looks right at 16–24).
 * Decorative by default (the crop name is always printed next to it); pass `title` to make it labelled.
 */
export function CropIcon({ id, size = 20, title, className }: { id: string; size?: number; title?: boolean; className?: string }) {
  const group = cropGroup(id);
  const glyph = G[id] ?? GROUP_FALLBACK[group];
  return (
    <span className={`crop-ic crop-ic-${group}${className ? ` ${className}` : ''}`} style={{ width: size, height: size }} {...(title ? { role: 'img', 'aria-label': cropName(id), title: cropName(id) } : { 'aria-hidden': true })}>
      <svg viewBox="0 0 20 20" width={Math.round(size * 0.84)} height={Math.round(size * 0.84)} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {glyph}
      </svg>
    </span>
  );
}

/** Both crops of a sequence, e.g. in tables: [icon] Name → [icon] Name. */
export function CropPair({ crops, size = 18 }: { crops: [string, string] | string[]; size?: number }) {
  return (
    <span className="crop-pair">
      <span className="crop-pair-item"><CropIcon id={crops[0]} size={size} />{cropName(crops[0])}</span>
      <span className="crop-pair-arrow" aria-hidden>→</span>
      <span className="crop-pair-item"><CropIcon id={crops[1]} size={size} />{cropName(crops[1])}</span>
    </span>
  );
}
