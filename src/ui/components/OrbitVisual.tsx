import { useReducedMotion } from 'framer-motion';

/** Hero illustration: a satellite orbits once every 20 s above a field grid; NASA data sources drop as chips.
 *  Colors come from tokens through the .ov-* classes in styles.css. The orbit is the app's only ambient animation. */
export function OrbitVisual() {
  const reduce = useReducedMotion();
  const orbit = 'M 210 28 A 170 34 0 1 1 210 96 A 170 34 0 1 1 210 28 Z';
  const tiles = [0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4, 5].map((c) => ({ r, c })));
  return (
    <svg viewBox="0 0 420 160" width="100%" height="100%" role="img" aria-label="A NASA satellite orbits above a farm field and sends climate data layers to it" className="ov">
      <path d={orbit} className="ov-ring" />
      <path d="M 196 44 L 150 132 L 270 132 L 224 44 Z" className="ov-beam" />
      <g transform="translate(210 140) skewX(-32) scale(1 .42)">
        {tiles.map(({ r, c }) => (
          <rect key={`${r}-${c}`} x={-96 + c * 32} y={-62 + r * 22} width={29} height={19} rx={2} className={(r + c) % 3 === 0 ? 'ov-tile-b' : 'ov-tile-a'} />
        ))}
      </g>
      <g className="ov-sat" transform={reduce ? 'translate(210 28)' : undefined}>
        <rect x={-7} y={-5} width={14} height={10} rx={2} className="ov-body" />
        <rect x={-25} y={-3.5} width={15} height={7} rx={1} className="ov-panel" />
        <rect x={10} y={-3.5} width={15} height={7} rx={1} className="ov-panel" />
        {!reduce && <animateMotion dur="20s" repeatCount="indefinite" path={orbit} />}
      </g>
      <g className="ov-chips">
        {/* chips sit in the corners, outside the orbit ellipse (x 40–380, y 28–96) and the satellite's path */}
        {[['POWER', 10, 2], ['SMAP', 364, 2], ['MODIS', 356, 112], ['IMERG', 10, 112]].map(([t, x, y]) => (
          <g key={t as string} transform={`translate(${x} ${y})`}>
            <rect width={(t as string).length * 8 + 14} height={18} rx={4} className="ov-chip" />
            <text x={7} y={13} className="ov-chip-t">{t}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
