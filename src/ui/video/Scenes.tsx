import type { CSSProperties, ReactNode } from 'react';
import { BookMarked, Check, CloudRain, Cpu, Droplets, FlaskConical, Leaf, Repeat, Satellite, Shovel, SlidersHorizontal, UserCheck, Wallet, WifiOff, Globe2, Sparkles, X } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import timing from './timing.json';
import { clamp, easeBack, easeInOut, easeOut, enter, lerp, pop, prog, rng, sceneAlpha } from './anim';

// ---------- real data used on screen ----------
// NASA POWER PRECTOTCORR, 1 Jun–31 Oct, Bambey-area grid cell (archived D1 query, 05_Climate_Indicators CSV).
const RAIN: [number, number][] = [[2001, 362.72], [2002, 308.92], [2003, 525.84], [2004, 496.58], [2005, 778.78], [2006, 654.74], [2007, 667.49], [2008, 967.04], [2009, 975.63], [2010, 783.65], [2011, 584.63], [2012, 675.37], [2013, 683.15], [2014, 588.49], [2015, 685.63], [2016, 480.42], [2017, 503.45], [2018, 483.83], [2019, 498.84], [2020, 824.38], [2021, 644.88], [2022, 823.87], [2023, 687.43], [2024, 682.83], [2025, 657.42]];

const W = 1920, H = 1080;
const display = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";
const scene = (id: string) => timing.scenes.find((s) => s.id === id)!;

function Stars({ t }: { t: number }) {
  const r = rng(7);
  const stars = Array.from({ length: 140 }, () => ({ x: r() * W, y: r() * H, s: r() * 1.8 + 0.4, o: r() * 0.6 + 0.2, d: r() * 0.6 + 0.2 }));
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
      {stars.map((s, i) => <circle key={i} cx={(s.x - t * 6 * s.d + W) % W} cy={s.y} r={s.s} fill="#fff" opacity={s.o * (0.75 + 0.25 * Math.sin(t * 2 + i))} />)}
    </svg>
  );
}

function Layer({ id, t, children }: { id: string; t: number; children: ReactNode }) {
  const s = scene(id);
  const a = sceneAlpha(t, s.start, s.end);
  if (a <= 0) return null;
  return <div style={{ position: 'absolute', inset: 0, opacity: a }}>{children}</div>;
}

const Kicker = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: '#6ee7b7', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 22, ...style }}>{children}</div>
);
const Title = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontFamily: display, fontWeight: 800, fontSize: 84, letterSpacing: '-.035em', lineHeight: 1.02, color: '#fff', ...style }}>{children}</div>
);
const grad: CSSProperties = { background: 'linear-gradient(90deg,#6ee7b7,#93c5fd)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };

// ---------- scene 1: hook ----------
function SceneTitle({ t }: { t: number }) {
  const s = scene('title');
  const k = prog(t, s.start, s.end);
  const sx = lerp(260, 1660, easeInOut(prog(t, 0, 3.4)));
  const sy = 330 - Math.sin(prog(t, 0, 3.4) * Math.PI) * 120;
  return (
    <>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="earth" cx="50%" cy="0%" r="75%"><stop offset="0" stopColor="#1d4ed8" /><stop offset=".5" stopColor="#0b1d3a" /><stop offset="1" stopColor="#050a14" /></radialGradient>
          <linearGradient id="limb" x1="0" x2="1"><stop offset="0" stopColor="#10b981" stopOpacity="0" /><stop offset=".5" stopColor="#6ee7b7" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
        </defs>
        <ellipse cx={W / 2} cy={H + 1050 - k * 40} rx={1700} ry={1250} fill="url(#earth)" />
        <ellipse cx={W / 2} cy={H + 1050 - k * 40} rx={1700} ry={1250} fill="none" stroke="url(#limb)" strokeWidth={4} opacity={0.9} />
        <path d={`M 120 ${420} Q ${W / 2} ${120} ${W - 120} ${420}`} fill="none" stroke="rgba(147,197,253,.25)" strokeDasharray="6 10" strokeWidth={2} />
        <g transform={`translate(${sx} ${sy})`}>
          <rect x={-22} y={-14} width={44} height={28} rx={6} fill="#f1f5f9" />
          <rect x={-86} y={-11} width={56} height={22} rx={3} fill="#2563eb" /><rect x={30} y={-11} width={56} height={22} rx={3} fill="#2563eb" />
          <circle r={6} fill="#10b981" />
          <path d={`M 0 16 L -160 ${H - sy - 220} L 160 ${H - sy - 220} Z`} fill="rgba(110,231,183,.08)" />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center' }}>
        <div style={enter(t, 0.25)}><Kicker>Every season</Kicker></div>
        <Title style={{ fontSize: 112, marginTop: 18, ...enter(t, 0.45, 0.7, 30) }}>Farming is a <span style={grad}>bet on the sky.</span></Title>
        <div style={{ color: '#9fb0c8', fontSize: 34, marginTop: 22, ...enter(t, 1.1) }}>Savings in. Weather unknown.</div>
      </div>
    </>
  );
}

// ---------- scene 2: rain variability ----------
function SceneRain({ t }: { t: number }) {
  const s = scene('rain'), t0 = s.start;
  const x0 = 200, x1 = 1400, y0 = 860, hMax = 500, bw = (x1 - x0) / RAIN.length;
  const max = 1000;
  const hiAt = t0 + 3.2;
  return (
    <>
      <div style={{ position: 'absolute', left: 200, top: 120 }}>
        <div style={enter(t, t0 + 0.1)}><Kicker><Satellite size={24} /> NASA POWER · 25 years of daily data · Bambey, Senegal</Kicker></div>
        <Title style={{ marginTop: 14, ...enter(t, t0 + 0.25) }}>Same field. <span style={grad}>A different sky every year.</span></Title>
      </div>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {[0, 250, 500, 750, 1000].map((v) => <g key={v} opacity={enter(t, t0 + 0.3).opacity as number}>
          <line x1={x0} x2={x1} y1={y0 - (v / max) * hMax} y2={y0 - (v / max) * hMax} stroke="rgba(255,255,255,.07)" />
          <text x={x0 - 18} y={y0 - (v / max) * hMax + 7} textAnchor="end" fill="#64748b" fontSize={20} fontFamily="Inter">{v}</text>
        </g>)}
        <text x={x0 - 18} y={y0 - hMax - 34} textAnchor="end" fill="#64748b" fontSize={18} fontFamily="Inter">mm, Jun–Oct</text>
        {RAIN.map(([y, v], i) => {
          const k = easeOut(prog(t, t0 + 0.5 + i * 0.07, t0 + 1.1 + i * 0.07));
          const h = (v / max) * hMax * k;
          const isMin = y === 2002, isMax = y === 2009;
          const hk = prog(t, hiAt, hiAt + 0.5);
          const fill = isMin ? `rgba(248,113,113,${0.55 + 0.45 * hk})` : isMax ? `rgba(52,211,153,${0.55 + 0.45 * hk})` : `rgba(96,165,250,${0.75 - 0.4 * hk})`;
          return (
            <g key={y}>
              <rect x={x0 + i * bw + 6} y={y0 - h} width={bw - 12} height={h} rx={6} fill={fill} />
              {((i % 4 === 0 && i > 0) || isMin || isMax) && <text x={x0 + i * bw + bw / 2} y={y0 + 34} textAnchor="middle" fill={isMin ? '#fca5a5' : isMax ? '#6ee7b7' : '#64748b'} fontSize={20} fontWeight={isMin || isMax ? 800 : 500} fontFamily="Inter">{y}</text>}
            </g>
          );
        })}
        {[[2002, 308.92, '#f87171'], [2009, 975.63, '#34d399']].map(([y, v, c]) => {
          const i = RAIN.findIndex((r) => r[0] === y);
          const a = easeOut(prog(t, hiAt + 0.2, hiAt + 0.8));
          const cx = x0 + i * bw + bw / 2, cy = y0 - ((v as number) / max) * hMax;
          return <g key={y as number} opacity={a} transform={`translate(0 ${(1 - a) * 12})`}>
            <rect x={cx - 74} y={cy - 74} width={148} height={50} rx={14} fill={c as string} />
            <text x={cx} y={cy - 40} textAnchor="middle" fill="#04130d" fontSize={26} fontWeight={800} fontFamily="Inter">{Math.round(v as number)} mm</text>
          </g>;
        })}
      </svg>
      <div style={{ position: 'absolute', left: 1470, top: 420, width: 330, ...pop(t, hiAt + 0.9, 0.6) }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 150, lineHeight: 1, letterSpacing: '-.05em', ...grad }}>3.2×</div>
        <div style={{ color: '#cbd5e1', fontSize: 28, marginTop: 4 }}>swing in season rain,<br />same grid cell</div>
        <div style={{ color: '#64748b', fontSize: 22, marginTop: 18 }}>309 mm in 2002<br />976 mm in 2009</div>
      </div>
      <div style={{ position: 'absolute', left: 200, top: 262, color: '#64748b', fontSize: 20, ...enter(t, t0 + 1) }}>NASA POWER PRECTOTCORR · 14.71°N 16.46°W · 2001–2025 · regional grid, not a field station</div>
    </>
  );
}

// ---------- scene 3: your budget, your priorities, your call ----------
function SceneCash({ t }: { t: number }) {
  const s = scene('cash'), t0 = s.start;
  const cards: [ReactNode, string, ReactNode, number][] = [
    [<Wallet size={44} />, 'Your budget', <><b style={{ color: '#fff' }}>380,000 XOF</b> to spend</>, t0 + 0.25],
    [<SlidersHorizontal size={44} />, 'Your priorities', 'cash · climate · soil · familiar crops', t0 + 0.95],
    [<UserCheck size={44} />, 'Your call', 'Field Shift advises. The farmer decides.', t0 + 1.65],
  ];
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center' }}>
        <div style={enter(t, t0 + 0.05)}><Kicker><Sparkles size={24} /> Tailored to each farmer</Kicker></div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center', gap: 40 }}>
        {cards.map(([icon, title, sub, at], i) => (
          <div key={i} style={{ width: 500, height: 420, borderRadius: 32, padding: '44px 40px', background: i === 2 ? 'linear-gradient(180deg, rgba(16,185,129,.2), rgba(16,185,129,.05))' : 'rgba(255,255,255,.05)', border: `2px solid ${i === 2 ? 'rgba(52,211,153,.7)' : 'rgba(255,255,255,.1)'}`, display: 'flex', flexDirection: 'column', gap: 22, ...pop(t, at, 0.5) }}>
            <div style={{ width: 92, height: 92, borderRadius: 26, display: 'grid', placeItems: 'center', background: 'rgba(110,231,183,.14)', color: '#6ee7b7' }}>{icon}</div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 60, letterSpacing: '-.03em', color: '#fff', lineHeight: 1.05 }}>{title}</div>
            <div style={{ color: '#cbd5e1', fontSize: 30, lineHeight: 1.3 }}>{sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- scene 4: data fusion ----------
const NASA_TILES: [ReactNode, string, string][] = [
  [<CloudRain size={34} />, 'NASA POWER', 'daily weather since 2001'],
  [<Droplets size={34} />, 'SMAP L4', 'root-zone soil moisture'],
  [<Leaf size={34} />, 'MODIS NDVI', 'vegetation greenness'],
  [<Satellite size={34} />, 'GPM IMERG', 'satellite rainfall'],
];
const FARM_TILES: [ReactNode, string, string][] = [
  [<FlaskConical size={34} />, '30,000+', 'field observations · 37 experiments'],
  [<Cpu size={34} />, 'XGBoost model', 'trained offline · in-browser'],
  [<Shovel size={34} />, 'SoilGrids', 'water the root zone holds'],
  [<Wallet size={34} />, 'FAOSTAT prices', 'local currency · 240 countries'],
];
function SceneFusion({ t }: { t: number }) {
  const s = scene('fusion'), t0 = s.start;
  const cx = W / 2, cy = 536;
  const tile = (side: 'l' | 'r', i: number, [icon, name, sub]: [ReactNode, string, string]) => {
    const at = t0 + 0.4 + i * 0.22 + (side === 'r' ? 1.7 : 0);
    const k = easeOut(prog(t, at, at + 0.6));
    const x = side === 'l' ? 140 : W - 140 - 470;
    const y = 290 + i * 128;
    const c = side === 'l' ? '#3b82f6' : '#f59e0b';
    return (
      <div key={name} style={{ position: 'absolute', left: x + (side === 'l' ? -1 : 1) * (1 - k) * 80, top: y, width: 470, height: 108, opacity: k, display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px', borderRadius: 24, background: 'rgba(255,255,255,.05)', border: `1px solid ${side === 'l' ? 'rgba(96,165,250,.35)' : 'rgba(251,191,36,.35)'}` }}>
        <div style={{ width: 70, height: 70, borderRadius: 20, display: 'grid', placeItems: 'center', background: `${c}22`, color: side === 'l' ? '#93c5fd' : '#fcd34d' }}>{icon}</div>
        <div><div style={{ color: '#fff', fontWeight: 800, fontSize: 32, fontFamily: display }}>{name}</div><div style={{ color: '#94a3b8', fontSize: 22 }}>{sub}</div></div>
      </div>
    );
  };
  const ring = t * 40;
  const coreK = easeBack(prog(t, t0 + 4.0, t0 + 4.7));
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 110, textAlign: 'center' }}>
        <div style={enter(t, t0 + 0.05)}><Kicker><Sparkles size={24} /> NASA is the engine</Kicker></div>
        <Title style={{ marginTop: 12, fontSize: 76, ...enter(t, t0 + 0.2) }}><span style={{ color: '#93c5fd' }}>Daily satellite data</span> + <span style={{ color: '#fcd34d' }}>field science</span></Title>
      </div>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {[0, 1, 2, 3].map((i) => ['l', 'r'].map((side) => {
          const at = t0 + 0.9 + i * 0.22 + (side === 'r' ? 1.7 : 0);
          const k = prog(t, at, at + 0.8);
          if (k <= 0) return null;
          const xa = side === 'l' ? 610 : W - 610, ya = 344 + i * 128;
          const P = [[xa, ya], [side === 'l' ? xa + 180 : xa - 180, ya], [side === 'l' ? cx - 220 : cx + 220, cy], [cx, cy]];
          const d = `M ${P[0]} C ${P[1]}, ${P[2]}, ${P[3]}`;
          const col = side === 'l' ? '#60a5fa' : '#fbbf24';
          const bez = (u: number) => [0, 1].map((ax) => (1 - u) ** 3 * P[0][ax] + 3 * (1 - u) ** 2 * u * P[1][ax] + 3 * (1 - u) * u * u * P[2][ax] + u ** 3 * P[3][ax]);
          return <g key={side + i}>
            <path d={d} fill="none" stroke={col} strokeOpacity={0.35} strokeWidth={3} strokeDasharray="1200" strokeDashoffset={1200 * (1 - easeOut(k))} />
            {k >= 1 && [0, 1, 2].map((j) => { const u = (((t - at - 0.8) * 0.65 + j / 3 + i * 0.11) % 1 + 1) % 1; const [px, py] = bez(u); return <circle key={j} cx={px} cy={py} r={6} fill={col} opacity={Math.sin(u * Math.PI)} />; })}
          </g>;
        }))}
        <g transform={`translate(${cx} ${cy}) scale(${Math.max(0.001, coreK)})`}>
          <circle r={150} fill="rgba(16,185,129,.12)" />
          <circle r={118} fill="none" stroke="rgba(110,231,183,.5)" strokeWidth={3} strokeDasharray="10 14" transform={`rotate(${ring})`} />
          <circle r={92} fill="#0b1d36" stroke="rgba(110,231,183,.6)" strokeWidth={2} />
        </g>
      </svg>
      {coreK > 0.05 && <div style={{ position: 'absolute', left: cx - 48, top: cy - 70, transform: `scale(${coreK})`, transformOrigin: '48px 70px', textAlign: 'center' }}><LogoMark size={96} /></div>}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 820, textAlign: 'center', ...enter(t, t0 + 4.4) }}>
        <div style={{ color: '#fff', fontFamily: display, fontWeight: 800, fontSize: 38 }}>One lightweight model · ≈ 3 MB · offline, in the browser</div>
        <div style={{ color: '#94a3b8', fontSize: 24, marginTop: 6 }}>NASA POWER daily → FAO-56 water balance → XGBoost soil-N → your ranking · any location on Earth</div>
      </div>
      {NASA_TILES.map((x, i) => tile('l', i, x))}
      {FARM_TILES.map((x, i) => tile('r', i, x))}
    </>
  );
}

// ---------- scene 5: results ----------
function PlanCard({ t, at, title, seq, budget, profit, score, good, highlight, w = 760 }: { t: number; at: number; title: string; seq: string; budget: string; profit: string; score: number; good: boolean; highlight?: boolean; w?: number }) {
  const k = easeOut(prog(t, at, at + 0.6));
  const glow = highlight ? clamp(prog(t, at + 0.8, at + 1.4)) : 0;
  const n = Math.round(score * easeOut(prog(t, at + 0.3, at + 1.0)));
  return (
    <div style={{ width: w, padding: '18px 28px', borderRadius: 26, opacity: k, transform: `translateX(${(1 - k) * 80}px) scale(${1 + glow * 0.03})`, background: highlight ? 'linear-gradient(180deg, rgba(16,185,129,.18), rgba(16,185,129,.05))' : 'rgba(255,255,255,.05)', border: `2px solid ${highlight ? `rgba(52,211,153,${0.4 + glow * 0.6})` : good ? 'rgba(255,255,255,.1)' : 'rgba(248,113,113,.35)'}`, boxShadow: highlight ? `0 0 ${60 * glow}px rgba(16,185,129,.45)` : 'none', display: 'grid', gridTemplateColumns: '1fr 120px', alignItems: 'center', columnGap: 20 }}>
      <div>
        <div style={{ color: highlight ? '#6ee7b7' : '#94a3b8', fontSize: 20, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ color: '#fff', fontFamily: display, fontSize: 34, fontWeight: 800, margin: '4px 0 10px', whiteSpace: 'nowrap' }}>{seq}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 22 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, fontWeight: 800, background: good ? 'rgba(52,211,153,.18)' : 'rgba(248,113,113,.18)', color: good ? '#6ee7b7' : '#fca5a5' }}>{good ? <Check size={20} /> : <X size={20} />}{budget}</span>
          <span style={{ color: '#cbd5e1' }}>profit <b style={{ color: '#fff' }}>{profit}</b></span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: '#94a3b8', fontSize: 18, fontWeight: 800, letterSpacing: '.12em' }}>SCORE</div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, lineHeight: 1, color: highlight ? '#6ee7b7' : '#fff' }}>{n}</div>
      </div>
    </div>
  );
}
function SceneResult({ t }: { t: number }) {
  const s = scene('result'), t0 = s.start;
  // climate resilience slides low → high; the scores follow (live engine output for the Senegal demo)
  const m = easeInOut(prog(t, t0 + 2.4, t0 + 3.6));
  const sliders: [ReactNode, string, number][] = [
    [<Wallet size={24} />, 'Keep cash in hand', 1],
    [<CloudRain size={24} />, 'Climate resilience', lerp(0.25, 1, m)],
    [<Repeat size={24} />, 'Crops I know', 0.25],
    [<Leaf size={24} />, 'Soil benefit', 0.25],
  ];
  return (
    <>
      <div style={{ position: 'absolute', left: 170, top: 110 }}>
        <div style={enter(t, t0 + 0.05)}><Kicker><SlidersHorizontal size={24} /> Dynamic, live</Kicker></div>
        <Title style={{ marginTop: 12, fontSize: 76, ...enter(t, t0 + 0.2) }}>Slide what matters. <span style={grad}>The ranking follows.</span></Title>
      </div>
      <div style={{ position: 'absolute', left: 170, top: 330, width: 640, padding: '30px 36px', borderRadius: 28, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', display: 'flex', flexDirection: 'column', gap: 30, ...enter(t, t0 + 0.4) }}>
        <div style={{ color: '#6ee7b7', fontSize: 20, fontWeight: 800, letterSpacing: '.14em' }}>WHAT MATTERS TO YOU</div>
        {sliders.map(([icon, label, v], i) => {
          const hot = i === 1 && m > 0 && m < 1;
          return (
            <div key={label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e2e8f0', fontSize: 28, fontWeight: 700, marginBottom: 14 }}><span style={{ color: '#94a3b8', display: 'inline-flex' }}>{icon}</span>{label}<span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 22, fontFamily: 'ui-monospace, monospace' }}>{v > 0.7 ? 'high' : v > 0.35 ? 'medium' : 'low'}</span></div>
              <div style={{ position: 'relative', height: 12, borderRadius: 6, background: 'rgba(255,255,255,.12)' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${v * 100}%`, borderRadius: 6, background: 'linear-gradient(90deg,#10b981,#6ee7b7)' }} />
                <div style={{ position: 'absolute', left: `calc(${v * 100}% - 15px)`, top: -9, width: 30, height: 30, borderRadius: 15, background: '#fff', boxShadow: hot ? '0 0 0 10px rgba(110,231,183,.3)' : '0 2px 8px rgba(0,0,0,.4)' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', right: 150, top: 310, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <PlanCard t={t} at={t0 + 0.8} title="Your usual plan" seq="🥜 Groundnut → 🌾 Pearl millet" budget="74,500 XOF over" profit="≈ 489,000" score={lerp(57, 54, m)} good={false} />
        <PlanCard t={t} at={t0 + 1.2} title="Best fit" seq="🌱 Sesame → 🫘 Cowpea" budget="26,800 XOF under" profit="≈ 744,000" score={100} good highlight />
        <PlanCard t={t} at={t0 + 1.6} title="Option B" seq="🌱 Sesame → 🌾 Pearl millet" budget="53,000 XOF under" profit="≈ 684,000" score={lerp(96, 98, m)} good />
      </div>
      <div style={{ position: 'absolute', left: 170, top: 880, display: 'flex', gap: 14, ...enter(t, t0 + 3.8) }}>
        {['Climate resilience from 24 real season pairs', 'Advice, not orders: the farmer decides'].map((x) => <span key={x} style={{ padding: '10px 18px', borderRadius: 999, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#e2e8f0', fontSize: 22, fontWeight: 600, display: 'inline-flex', gap: 8, alignItems: 'center' }}><Check size={20} color="#6ee7b7" /> {x}</span>)}
      </div>
    </>
  );
}

// ---------- scene 6: close ----------
function SceneClose({ t }: { t: number }) {
  const s = scene('close'), t0 = s.start;
  const k = easeBack(prog(t, t0 + 0.1, t0 + 0.8));
  const out = prog(t, 29.3, 30);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', transform: `scale(${Math.max(0.01, k)})` }}><LogoMark size={190} /></div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 136, letterSpacing: '-.045em', color: '#fff', marginTop: 20, ...enter(t, t0 + 0.4, 0.6, 30) }}>Field Shift</div>
        <div style={{ fontSize: 46, fontFamily: display, fontWeight: 700, marginTop: 6, ...grad, ...enter(t, t0 + 0.8) }}>From space to soil.</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 48, ...enter(t, t0 + 1.3) }}>
          {([[<Satellite size={22} />, 'NASA POWER · SMAP · MODIS · IMERG'], [<WifiOff size={22} />, 'Works offline'], [<Globe2 size={22} />, 'Anywhere on Earth'], [<BookMarked size={22} />, 'Explainable']] as const).map(([i, x]) => <span key={x} style={{ padding: '12px 20px', borderRadius: 999, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: '#e2e8f0', fontSize: 24, fontWeight: 600, display: 'inline-flex', gap: 10, alignItems: 'center' }}>{i}{x}</span>)}
        </div>
        <div style={{ color: '#64748b', fontSize: 22, marginTop: 40, ...enter(t, t0 + 1.8) }}>NASA Space Apps 2026 · Field Shift challenge · NASA does not endorse this project</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: out }} />
    </>
  );
}

// ---------- captions ----------
function Captions({ t }: { t: number }) {
  const line = timing.lines.find((l) => t >= l.start - 0.05 && t <= l.end + 0.25);
  if (!line) return null;
  const words = line.text.split(' ');
  const k = prog(t, line.start, line.end);
  const lit = Math.floor(k * words.length + 0.5);
  const a = Math.min(prog(t, line.start - 0.05, line.start + 0.15), 1 - prog(t, line.end + 0.05, line.end + 0.25));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center', opacity: a }}>
      <div style={{ maxWidth: 1500, padding: '12px 26px', borderRadius: 16, background: 'rgba(3,7,15,.72)', border: '1px solid rgba(255,255,255,.08)', fontSize: 30, fontWeight: 600, textAlign: 'center', lineHeight: 1.35 }}>
        {words.map((w, i) => <span key={i} style={{ color: i < lit ? '#fff' : 'rgba(255,255,255,.42)' }}>{w} </span>)}
      </div>
    </div>
  );
}

/** One 1920×1080 frame of the 30-second film at time t (seconds). */
export function VideoFrame({ t, captions = true }: { t: number; captions?: boolean }) {
  const bgShift = easeInOut(clamp(t / 30));
  return (
    <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', background: `radial-gradient(1200px 700px at ${80 - bgShift * 40}% -10%, rgba(37,99,235,.38), transparent 60%), radial-gradient(1000px 600px at ${bgShift * 30}% 115%, rgba(16,185,129,.32), transparent 60%), #050a14` }}>
      <Stars t={t} />
      {t > scene('title').end - 0.2 && t < scene('close').start + 0.2 && (
        <div style={{ position: 'absolute', left: 60, top: 46, display: 'flex', alignItems: 'center', gap: 14, opacity: 0.85 }}>
          <LogoMark size={46} glow={false} /><span style={{ color: '#fff', fontWeight: 800, fontFamily: display, fontSize: 28, letterSpacing: '-.02em' }}>Field Shift</span>
        </div>
      )}
      <Layer id="title" t={t}><SceneTitle t={t} /></Layer>
      <Layer id="rain" t={t}><SceneRain t={t} /></Layer>
      <Layer id="cash" t={t}><SceneCash t={t} /></Layer>
      <Layer id="fusion" t={t}><SceneFusion t={t} /></Layer>
      <Layer id="result" t={t}><SceneResult t={t} /></Layer>
      <Layer id="close" t={t}><SceneClose t={t} /></Layer>
      {captions && <Captions t={t} />}
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 5, width: `${(t / 30) * 100}%`, background: 'linear-gradient(90deg,#10b981,#3b82f6)', opacity: 0.8 }} />
    </div>
  );
}
export const VIDEO_W = W, VIDEO_H = H, VIDEO_DURATION = timing.duration;
export { lerp };
