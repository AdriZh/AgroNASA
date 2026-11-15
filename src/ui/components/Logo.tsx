/** Flat app mark for the shell and slides: a sprout under an orbit, drawn in currentColor on a --brand square (see .brand-mark).
 *  LogoMark below stays as-is because the pre-rendered video (src/ui/video) draws it. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size, flexBasis: size }} aria-hidden>
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="24" cy="25" rx="18" ry="7.5" strokeWidth="2" opacity=".6" transform="rotate(-24 24 25)" />
        <path d="M24 38 V24" strokeWidth="3" />
        <path d="M24 26 C 17 26, 14 21, 14.5 15.5 C 20 15.5, 24 19, 24 26 Z" fill="currentColor" strokeWidth="1.5" />
        <path d="M24 23 C 30 23, 33.5 18.5, 33.5 13 C 28 13, 24 16.5, 24 23 Z" fill="currentColor" strokeWidth="1.5" />
        <circle cx="40" cy="17" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

/** Field Shift mark: a satellite orbit circling a two-leaf sprout (rotation + Earth observation). */
export function LogoMark({ size = 38, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Field Shift" style={glow ? { filter: 'drop-shadow(0 6px 14px rgba(16,185,129,.35))' } : undefined}>
      <defs>
        <linearGradient id="fs-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="fs-leaf" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#d1fae5" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="14" fill="url(#fs-g)" />
      <ellipse cx="24" cy="25" rx="17" ry="7.5" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.6" transform="rotate(-24 24 25)" />
      <path d="M24 36 V24" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 26 C 17 26, 14 21, 14.5 15.5 C 20 15.5, 24 19, 24 26 Z" fill="url(#fs-leaf)" />
      <path d="M24 23 C 30 23, 33.5 18.5, 33.5 13 C 28 13, 24 16.5, 24 23 Z" fill="#fff" />
      <circle cx="39.2" cy="17.6" r="2.6" fill="#fff" />
    </svg>
  );
}
