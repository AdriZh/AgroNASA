/** Animated hero illustration: a satellite on orbit beams data layers onto a field grid. Pure SVG + CSS. */
export function OrbitVisual() {
  return (
    <svg viewBox="0 0 420 300" width="100%" height="100%" role="img" aria-label="Satellite sending climate data layers to a farm field">
      <defs>
        <radialGradient id="ov-earth" cx="50%" cy="0%" r="90%">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset=".6" stopColor="#0b1d3a" />
          <stop offset="1" stopColor="#070d1a" />
        </radialGradient>
        <linearGradient id="ov-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee7b7" stopOpacity=".55" />
          <stop offset="1" stopColor="#6ee7b7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ov-field" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <style>{`
        .ov-orbit { transform-origin: 210px 150px; animation: ov-spin 18s linear infinite; }
        .ov-pulse { animation: ov-pulse 2.4s ease-in-out infinite; }
        .ov-l1 { animation: ov-drop 3.6s ease-in-out infinite; }
        .ov-l2 { animation: ov-drop 3.6s ease-in-out .6s infinite; }
        .ov-l3 { animation: ov-drop 3.6s ease-in-out 1.2s infinite; }
        .ov-grow { transform-origin: bottom; animation: ov-grow 3s ease-in-out infinite alternate; }
        @keyframes ov-spin { to { transform: rotate(360deg); } }
        @keyframes ov-pulse { 50% { opacity: .35; } }
        @keyframes ov-drop { 0% { transform: translateY(-10px); opacity: 0; } 25% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(70px); opacity: 0; } }
        @keyframes ov-grow { from { transform: scaleY(.65); } to { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .ov-orbit, .ov-pulse, .ov-l1, .ov-l2, .ov-l3, .ov-grow { animation: none; } }
      `}</style>
      <ellipse cx="210" cy="150" rx="190" ry="62" fill="none" stroke="rgba(147,197,253,.18)" strokeDasharray="3 6" transform="rotate(-12 210 150)" />
      <g className="ov-orbit">
        <g transform="translate(372 120)">
          <rect x="-9" y="-6" width="18" height="12" rx="3" fill="#e2e8f0" />
          <rect x="-30" y="-4" width="18" height="8" rx="1.5" fill="#3b82f6" />
          <rect x="12" y="-4" width="18" height="8" rx="1.5" fill="#3b82f6" />
          <circle r="2" fill="#10b981" />
        </g>
      </g>
      <g transform="translate(210 46)">
        <rect x="-12" y="-8" width="24" height="16" rx="4" fill="#f8fafc" />
        <rect x="-44" y="-6" width="28" height="12" rx="2" fill="#2563eb" />
        <rect x="16" y="-6" width="28" height="12" rx="2" fill="#2563eb" />
        <path d="M-44 0 H-16 M16 0 H44" stroke="#93c5fd" strokeWidth=".8" />
        <circle r="3" fill="#10b981" className="ov-pulse" />
      </g>
      <path d="M200 60 L150 210 L270 210 L220 60 Z" fill="url(#ov-beam)" />
      <g fontFamily="Inter, sans-serif" fontSize="9" fontWeight="700">
        <g className="ov-l1"><rect x="168" y="84" width="84" height="18" rx="9" fill="rgba(59,130,246,.9)" /><text x="210" y="96" textAnchor="middle" fill="#fff">RAIN · HEAT</text></g>
        <g className="ov-l2"><rect x="168" y="84" width="84" height="18" rx="9" fill="rgba(16,185,129,.9)" /><text x="210" y="96" textAnchor="middle" fill="#fff">SOIL MOISTURE</text></g>
        <g className="ov-l3"><rect x="168" y="84" width="84" height="18" rx="9" fill="rgba(139,92,246,.9)" /><text x="210" y="96" textAnchor="middle" fill="#fff">VEGETATION</text></g>
      </g>
      <path d="M0 300 Q210 170 420 300 Z" fill="url(#ov-earth)" />
      <g transform="translate(210 232) skewX(-28) scale(1 .5)">
        {[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => (
          <rect key={`${r}-${c}`} x={-75 + c * 30} y={-40 + r * 22} width="27" height="19" rx="3" fill={(r + c) % 3 === 0 ? '#065f46' : (r + c) % 3 === 1 ? 'url(#ov-field)' : '#a16207'} opacity=".95" />
        )))}
      </g>
      {[[160, 236], [190, 228], [228, 238], [258, 230]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}><g className="ov-grow" style={{ animationDelay: `${i * 0.3}s` }}>
          <path d="M0 0 V-14" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" />
          <path d="M0 -8 C -6 -8 -8 -12 -8 -16 C -3 -16 0 -13 0 -8 Z" fill="#6ee7b7" />
          <path d="M0 -10 C 6 -10 8 -14 8 -18 C 3 -18 0 -15 0 -10 Z" fill="#a7f3d0" />
        </g></g>
      ))}
    </svg>
  );
}
