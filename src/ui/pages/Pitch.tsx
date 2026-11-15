import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, Ban, BookMarked, Calculator, Check, ChevronLeft, ChevronRight, CloudRain, Droplets, Eye, FileDown, FlaskConical, Globe2, Layers, Leaf,
  Map as MapIcon, Microscope, NotebookPen, Satellite, Scale, Shovel, Sprout, Tractor, Users, Wallet, WifiOff, X, Sun, Thermometer,
} from 'lucide-react';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import { seasonEndOf } from './Evidence';
import { cropEmoji, cropName, CROPS } from '../../data/crops';
import { fmtMoney } from '../../domain/units';
import { addDays, dayIndex, fmtDayMonth } from '../../domain/dates';
import { median, rainOnset, temperatureSowing, yearlyWindow } from '../../weather/indicators';
import { LogoMark } from '../components/Logo';
import { OrbitVisual } from '../components/OrbitVisual';
import { pct } from '../components/common';
import type { PlanResult } from '../../engine/plan';

const ease = [0.2, 0.8, 0.2, 1] as const;
const up = (d = 0) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: d, ease } });
const fade = (d = 0) => ({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.6, delay: d } });

function Slide({ n, total, kicker, icon, children }: { n: number; total: number; kicker: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="slide">
      <motion.div className="kicker" {...up(0)}>{icon}{kicker}</motion.div>
      {children}
      <div className="foot"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><LogoMark size={18} glow={false} /> Field Shift · NASA Space Apps 2026</span><span>{n} / {total}</span></div>
    </div>
  );
}

const G = ({ children }: { children: ReactNode }) => <span className="grad">{children}</span>;

function Glass({ children, d = 0, style }: { children: ReactNode; d?: number; style?: React.CSSProperties }) {
  return <motion.div className="glass" {...up(d)} style={style}>{children}</motion.div>;
}

// ---------- visuals ----------
function RainBars({ rows }: { rows: { year: number; windowRain: number }[] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.windowRain)), min = Math.min(...rows.map((r) => r.windowRain));
  const W = 620, H = 300, bw = W / rows.length;
  const med = median(rows.map((r) => r.windowRain));
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} width="100%">
      <line x1={0} x2={W} y1={H - (med / max) * (H - 30)} y2={H - (med / max) * (H - 30)} stroke="rgba(255,255,255,.35)" strokeDasharray="4 5" />
      <text x={W - 4} y={H - (med / max) * (H - 30) + 16} textAnchor="end" fill="#c3cee0" fontSize={12} style={{ paintOrder: 'stroke', stroke: '#070d1a', strokeWidth: 4 }}>median {Math.round(med)} mm</text>
      {rows.map((r, i) => {
        const h = (r.windowRain / max) * (H - 30);
        const c = r.windowRain === min ? '#f87171' : r.windowRain === max ? '#34d399' : '#3b82f6';
        return (
          <g key={r.year}>
            <motion.rect x={i * bw + 3} width={bw - 6} rx={4} fill={c} initial={{ y: H, height: 0 }} animate={{ y: H - h, height: h }} transition={{ duration: 0.7, delay: 0.3 + i * 0.035, ease }} />
            {(r.windowRain === min || r.windowRain === max) && <motion.text {...fade(1.4)} x={Math.max(34, Math.min(W - 34, i * bw + bw / 2))} y={H - h - 10} textAnchor="middle" fill={c} fontSize={14} fontWeight={800}>{Math.round(r.windowRain)} mm</motion.text>}
            {i % 4 === 0 && <text x={i * bw + bw / 2} y={H + 22} textAnchor="middle" fill="#5d6c86" fontSize={12}>{r.year}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function CashBar({ plan, cap, cur }: { plan: PlanResult; cap: number; cur: string }) {
  const cats: [string, string][] = [['seed', '#10b981'], ['fertilizer', '#8b5cf6'], ['labor', '#f59e0b'], ['land-prep', '#a16207'], ['protection', '#ef4444'], ['irrigation', '#3b82f6'], ['other', '#94a3b8']];
  const total = plan.budget.totalCash;
  const scaleMax = Math.max(total, cap) * 1.12;
  let acc = 0;
  return (
    <div>
      <div style={{ position: 'relative', height: 86, borderRadius: 18, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
        {cats.map(([c, col], i) => {
          const v = plan.budget.lines.filter((l) => l.cash && l.category === c).reduce((a, l) => a + (l.total ?? 0), 0);
          if (!v) return null;
          const left = (acc / scaleMax) * 100; acc += v;
          return <motion.div key={c} title={c} initial={{ width: 0 }} animate={{ width: `${(v / scaleMax) * 100}%` }} transition={{ duration: 0.5, delay: 0.4 + i * 0.18, ease }} style={{ position: 'absolute', top: 12, bottom: 12, left: `${left}%`, background: col, borderRadius: 10, display: 'flex', alignItems: 'center', paddingLeft: 10, color: '#04130d', fontWeight: 800, fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap' }}>{v / scaleMax > 0.1 ? c : ''}</motion.div>;
        })}
        <div style={{ position: 'absolute', left: `${(cap / scaleMax) * 100}%`, top: -12, bottom: -10, width: 3, background: '#fff', borderRadius: 3, boxShadow: '0 0 18px rgba(255,255,255,.7)' }} />
        <div style={{ position: 'absolute', left: `${(cap / scaleMax) * 100}%`, top: -38, transform: 'translateX(-50%)', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>spendable {fmtMoney(cap, cur)}</div>
      </div>
      <div className="row" style={{ marginTop: 18, gap: 36 }}>
        <div><div className="muted" style={{ fontSize: '.85rem' }}>Usual plan · {cropName(plan.crops[0])} → {cropName(plan.crops[1])}</div><div className="big" style={{ fontSize: '2.3rem', background: 'none', color: '#fff' }}>{fmtMoney(total, cur)}</div></div>
        <motion.div {...up(1.8)}><div className="muted" style={{ fontSize: '.85rem' }}>{plan.budget.headroom < 0 ? 'Over budget' : 'Headroom'}</div><div className="big" style={{ fontSize: '2.3rem', background: 'none', color: plan.budget.headroom < 0 ? '#f87171' : '#6ee7b7' }}>{plan.budget.headroom < 0 ? '−' : '+'}{fmtMoney(Math.abs(plan.budget.headroom), cur)}</div></motion.div>
      </div>
    </div>
  );
}

function FusionDiagram() {
  const left: [ReactNode, string, string][] = [[<CloudRain size={18} />, 'NASA POWER', 'rain, heat, wind, sun, 2001→now, any point'], [<Droplets size={18} />, 'SMAP L4 · POWER GWETROOT', 'soil moisture now vs normal'], [<Leaf size={18} />, 'MODIS NDVI · land cover', 'your field’s greenness since 2000'], [<Satellite size={18} />, 'GRACE · EONET · IMERG', 'groundwater trend, hazards, rain']];
  const right: [ReactNode, string, string][] = [[<NotebookPen size={18} />, 'Crop & fertilizer history', 'farmer records'], [<Wallet size={18} />, 'Budget + FAOSTAT prices', 'cash, reserve, real crop prices, FX'], [<Shovel size={18} />, 'SoilGrids + farmer texture', 'water-holding capacity'], [<BookMarked size={18} />, 'Regional rule pack', 'calendars, rotations, sources']];
  const out = ['Feasible plans', 'Cost & cash timing', 'Climate risk range', 'Reasons & sources'];
  const tile = (side: 'l' | 'r', [i, t, s]: [ReactNode, string, string], k: number) => (
    <motion.div key={t} initial={{ opacity: 0, x: side === 'l' ? -30 : 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + k * 0.12 + (side === 'r' ? 0.5 : 0), duration: 0.5, ease }}
      className="glass" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderColor: side === 'l' ? 'rgba(96,165,250,.35)' : 'rgba(251,191,36,.35)' }}>
      <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: side === 'l' ? 'rgba(59,130,246,.18)' : 'rgba(245,158,11,.18)', color: side === 'l' ? '#93c5fd' : '#fcd34d', flex: '0 0 36px' }}>{i}</span>
      <div><b style={{ fontSize: '.92rem' }}>{t}</b><div className="muted" style={{ fontSize: '.78rem' }}>{s}</div></div>
    </motion.div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px 1fr', gap: 20, alignItems: 'center', flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><div className="muted" style={{ fontSize: '.75rem', letterSpacing: '.12em', fontWeight: 800 }}>NASA</div>{left.map((x, k) => tile('l', x, k))}</div>
      <div style={{ position: 'relative', height: '100%', minHeight: 280, display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 230 300" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {[40, 110, 180, 250].map((y, k) => (
            <g key={y}>
              <motion.path d={`M 0 ${y} C 60 ${y}, 70 150, 115 150`} stroke="#60a5fa" strokeOpacity={0.5} strokeWidth={2} fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.6 + k * 0.12, duration: 0.8 }} />
              <motion.path d={`M 230 ${y} C 170 ${y}, 160 150, 115 150`} stroke="#fbbf24" strokeOpacity={0.5} strokeWidth={2} fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1 + k * 0.12, duration: 0.8 }} />
            </g>
          ))}
          <motion.circle cx={115} cy={150} r={62} fill="rgba(16,185,129,.12)" stroke="rgba(110,231,183,.5)" strokeDasharray="6 8" initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ scale: { delay: 1.5, duration: 0.5 }, rotate: { duration: 30, repeat: Infinity, ease: 'linear' } }} style={{ transformOrigin: '115px 150px' }} />
        </svg>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.6, type: 'spring', stiffness: 200, damping: 14 }} style={{ textAlign: 'center', position: 'relative' }}>
          <LogoMark size={64} />
          <div style={{ fontWeight: 800, marginTop: 6, fontSize: '.85rem' }}>Field Shift engine</div>
        </motion.div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><div className="muted" style={{ fontSize: '.75rem', letterSpacing: '.12em', fontWeight: 800, textAlign: 'right' }}>FARMER & LOCAL</div>{right.map((x, k) => tile('r', x, k))}</div>
      <motion.div {...up(2)} style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        {out.map((o) => <span key={o} style={{ padding: '8px 14px', borderRadius: 999, background: 'rgba(16,185,129,.14)', border: '1px solid rgba(110,231,183,.35)', color: '#d1fae5', fontWeight: 700, fontSize: '.85rem', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Check size={14} />{o}</span>)}
      </motion.div>
    </div>
  );
}

function SowingVisual() {
  const { data, engine } = useApp();
  const s = data.series, w = engine?.window;
  const view = useMemo(() => {
    if (!s || !w || !engine) return null;
    const year = 2024;
    const startISO = `${year}-${w.earliest}`, n = 80;
    const i0 = dayIndex(s.meta.start, startISO);
    if (w.method === 'rain-onset') {
      const on = rainOnset(s, year, w.earliest, w.latest).date;
      return { kind: 'rain' as const, year, startISO, vals: Array.from({ length: n }, (_, k) => s.P[i0 + k] ?? 0), mark: on ? dayIndex(startISO, on) : -1, label: on ? fmtDayMonth(on) : 'none' };
    }
    const crop = CROPS[engine.pack.crops[0]];
    const d = temperatureSowing(s, year, w.earliest, w.latest, crop.sowTempC);
    return { kind: 'temp' as const, year, startISO, vals: Array.from({ length: n }, (_, k) => s.T[i0 + k] ?? 0), mark: d ? dayIndex(startISO, d) : -1, label: d ? fmtDayMonth(d) : 'none', thr: crop.sowTempC, crop: crop.name };
  }, [s, w, engine]);
  if (!view) return null;
  const W = 600, H = 240, bw = W / view.vals.length;
  const max = Math.max(...view.vals, view.kind === 'temp' ? (view.thr ?? 0) + 4 : 30);
  const min = view.kind === 'temp' ? Math.min(...view.vals, 0) : 0;
  const y = (v: number) => H - ((v - min) / (max - min)) * (H - 20);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 26}`} width="100%">
        {view.kind === 'rain' ? view.vals.map((v, k) => (
          <motion.rect key={k} x={k * bw + 1} width={bw - 2} rx={2} fill={k >= view.mark && k < view.mark + 3 && view.mark >= 0 ? '#34d399' : '#3b82f6'} initial={{ y: H, height: 0 }} animate={{ y: y(v), height: H - y(v) }} transition={{ delay: 0.3 + k * 0.012, duration: 0.4 }} />
        )) : (
          <>
            <motion.polyline points={view.vals.map((v, k) => `${k * bw + bw / 2},${y(v)}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth={2.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 1.4 }} />
            <line x1={0} x2={W} y1={y(view.thr!)} y2={y(view.thr!)} stroke="#f87171" strokeDasharray="5 5" />
            <text x={W - 4} y={y(view.thr!) - 6} textAnchor="end" fill="#fca5a5" fontSize={12}>{view.crop} sowing threshold {view.thr} °C</text>
          </>
        )}
        {view.mark >= 0 && <motion.g {...fade(1.4)}>
          <line x1={view.mark * bw + bw / 2} x2={view.mark * bw + bw / 2} y1={10} y2={H} stroke="#6ee7b7" strokeWidth={2} />
          <rect x={view.mark * bw + bw / 2 - 64} y={0} width={128} height={24} rx={12} fill="#10b981" />
          <text x={view.mark * bw + bw / 2} y={16} textAnchor="middle" fill="#04130d" fontWeight={800} fontSize={12}>sow ≈ {view.label} {view.year}</text>
        </motion.g>}
        {[0, 20, 40, 60].map((k) => <text key={k} x={k * bw} y={H + 20} fill="#5d6c86" fontSize={12}>{fmtDayMonth(addDays(view.startISO, k))}</text>)}
      </svg>
      <div className="muted" style={{ fontSize: '.78rem' }}>{view.kind === 'rain' ? `Daily NASA POWER rain from ${fmtDayMonth(view.startISO)} ${view.year} — green = first 3-day total ≥ 20 mm with no >7-day dry spell after it.` : `Daily NASA POWER mean air temperature from ${fmtDayMonth(view.startISO)} ${view.year}, sown when the 5-day mean passes the crop threshold (and after the usual last frost for frost-sensitive crops).`}</div>
    </div>
  );
}

function Bucket() {
  return (
    <svg viewBox="0 0 360 320" width="100%">
      <defs>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c4a1e" /><stop offset="1" stopColor="#3b220c" /></linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#60a5fa" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient>
      </defs>
      <rect x={90} y={80} width={180} height={200} rx={14} fill="url(#soil)" stroke="rgba(255,255,255,.2)" />
      <motion.rect x={92} width={176} rx={10} fill="url(#water)" opacity={0.85} initial={{ y: 200, height: 78 }} animate={{ y: [200, 130, 165, 200, 238, 200], height: [78, 148, 113, 78, 40, 78] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} />
      <line x1={80} x2={280} y1={100} y2={100} stroke="#6ee7b7" strokeDasharray="5 4" /><text x={286} y={104} fill="#6ee7b7" fontSize={12}>field capacity</text>
      <line x1={80} x2={280} y1={190} y2={190} stroke="#fbbf24" strokeDasharray="5 4" /><text x={286} y={186} fill="#fcd34d" fontSize={12}>stress starts</text><text x={286} y={200} fill="#fcd34d" fontSize={11}>(p × TAW)</text>
      <line x1={80} x2={280} y1={270} y2={270} stroke="#f87171" strokeDasharray="5 4" /><text x={286} y={274} fill="#fca5a5" fontSize={12}>wilting point</text>
      <g>
        <motion.g animate={{ y: [0, 10, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <path d="M150 20 v40 M180 10 v50 M210 20 v40" stroke="#93c5fd" strokeWidth={4} strokeLinecap="round" />
          <path d="M140 52 l10 12 l10 -12 M170 52 l10 12 l10 -12 M200 52 l10 12 l10 -12" stroke="#93c5fd" strokeWidth={3} fill="none" />
        </motion.g>
        <text x={182} y={8} textAnchor="middle" fill="#93c5fd" fontSize={12} fontWeight={700}>RAIN (NASA POWER)</text>
      </g>
      <motion.g animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
        <path d="M40 150 q10 -20 0 -40 q-10 -20 0 -40" stroke="#fcd34d" strokeWidth={3} fill="none" />
        <text x={40} y={170} textAnchor="middle" fill="#fcd34d" fontSize={12} fontWeight={700}>ET</text>
        <text x={40} y={184} textAnchor="middle" fill="#8d9ab0" fontSize={10}>Kc × ET₀</text>
      </motion.g>
      <path d="M180 284 v26" stroke="#64748b" strokeWidth={3} /><path d="M172 302 l8 10 l8 -10" stroke="#64748b" strokeWidth={3} fill="none" />
      <text x={200} y={312} fill="#8d9ab0" fontSize={11}>drainage</text>
    </svg>
  );
}

function Funnel({ steps }: { steps: [string, number, string][] }) {
  const max = steps[0][1] || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map(([label, n, note], i) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}><b>{label}</b><div className="muted" style={{ fontSize: '.78rem' }}>{note}</div></div>
          <div style={{ height: 46, background: 'rgba(255,255,255,.04)', borderRadius: 12, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(6, (n / max) * 100)}%` }} transition={{ delay: 0.3 + i * 0.25, duration: 0.7, ease }}
              style={{ height: '100%', borderRadius: 12, background: ['#3b82f6', '#6366f1', '#8b5cf6', '#10b981'][i] ?? '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 14, fontWeight: 800, fontSize: '1.2rem', color: '#fff' }}>{n}</motion.div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanTile({ p, cur, d }: { p: PlanResult; cur: string; d: number }) {
  const ok = p.budget.status === 'affordable';
  const best = p.rank === 1;
  return (
    <motion.div {...up(d)} className="glass" style={{ padding: 18, border: best ? '2px solid #34d399' : p.isBaseline ? '1px dashed rgba(255,255,255,.25)' : undefined, boxShadow: best ? '0 0 40px rgba(16,185,129,.25)' : undefined }}>
      <div className="muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, color: best ? '#6ee7b7' : undefined }}>{p.isBaseline ? 'Usual plan' : `${p.label}${best ? ' · best fit' : ''}`}</div>
      <div style={{ fontWeight: 800, fontSize: '1.15rem', margin: '8px 0', fontFamily: 'var(--display)' }}>{cropEmoji(p.crops[0])} {cropName(p.crops[0])} → {cropEmoji(p.crops[1])} {cropName(p.crops[1])}</div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontWeight: 800, fontSize: '.85rem', background: ok ? 'rgba(52,211,153,.16)' : 'rgba(248,113,113,.16)', color: ok ? '#6ee7b7' : '#fca5a5' }}>{ok ? <Check size={14} /> : <X size={14} />}{ok ? `Fits · +${fmtMoney(p.budget.headroom, cur)}` : p.budget.status === 'unaffordable' ? `Over by ${fmtMoney(-p.budget.headroom, cur)}` : p.budget.status}</span>
      <div style={{ marginTop: 12, fontSize: '.85rem' }} className="muted">Cash {fmtMoney(p.budget.totalCash, cur)}</div>
      <div style={{ marginTop: 8 }}>
        <div className="spread" style={{ fontSize: '.78rem' }}><span className="muted">Severe-stress seasons</span><b>{pct(p.outcome.pSevereAny)}</b></div>
        <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,.08)', marginTop: 4, overflow: 'hidden' }}><motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(2, p.outcome.pSevereAny * 100)}%` }} transition={{ delay: d + 0.4, duration: 0.6 }} style={{ height: '100%', background: p.outcome.pSevereAny < 0.15 ? '#34d399' : p.outcome.pSevereAny < 0.35 ? '#fbbf24' : '#f87171' }} /></div>
      </div>
      <div style={{ marginTop: 10, fontSize: '.78rem', color: '#c3cee0' }}>{p.reasons.filter((r) => r.severity !== 'info').slice(0, 2).map((r) => r.text.replace(/^Season \d \(([^)]+)\): /, '$1: ')).join(' · ')}</div>
    </motion.div>
  );
}

// ---------- deck ----------
export function PitchPage({ go }: { go: (r: Route) => void }) {
  const { engine, data, scenario } = useApp();
  const [cut, setCut] = useState<'full' | 'submission'>('full');
  const [i, setI] = useState(0);
  const [printing, setPrinting] = useState(false);
  const rows = useMemo(() => (data.series && engine ? yearlyWindow(data.series, engine.window.earliest, seasonEndOf(engine)) : []), [data.series, engine]);
  const mn = rows.length ? Math.min(...rows.map((r) => r.windowRain)) : 0, mx = rows.length ? Math.max(...rows.map((r) => r.windowRain)) : 0;
  const cur = scenario.currency;
  const place = (scenario.location.label ?? '').split(',')[0] || 'this site';
  const plans = engine ? [engine.baseline, ...engine.alternatives] : [];

  const all: { id: string; kicker: string; icon: ReactNode; body: ReactNode }[] = [
    { id: 'title', kicker: 'NASA Space Apps 2026 · Field Shift challenge', icon: <BadgeCheck size={14} />, body: (
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 30, alignItems: 'center' }}>
        <div>
          <motion.div {...up(0.1)} style={{ display: 'flex', alignItems: 'center', gap: 16 }}><LogoMark size={64} /><span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: '2rem' }}>Field Shift</span></motion.div>
          <motion.h1 {...up(0.25)} style={{ margin: '22px 0 14px', lineHeight: 1.02 }}>Crop plans farmers can <G>afford</G>, informed by <G>25 years of NASA Earth data</G>.</motion.h1>
          <motion.p {...up(0.45)} style={{ fontSize: '1.15rem', maxWidth: 620 }}>We combine satellite climate history with what the farmer already knows — past crops, soil, budget and constraints — and explain every trade-off.</motion.p>
          <motion.div {...up(0.65)} className="row" style={{ marginTop: 18 }}>{['Informs, never dictates', 'Works offline', 'Any location on Earth'].map((x) => <span key={x} style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', fontSize: '.85rem', color: '#d6e0ee' }}>{x}</span>)}</motion.div>
        </div>
        <motion.div {...fade(0.3)} style={{ height: '100%', minHeight: 260 }}><OrbitVisual /></motion.div>
      </div>
    ) },
    { id: 'problem', kicker: 'The problem', icon: <CloudRain size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Every season, farmers bet their savings on the sky.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 28, flex: 1, alignItems: 'center' }}>
          <div><RainBars rows={rows} /><div className="muted" style={{ fontSize: '.75rem' }}>Season rainfall by year at {place}, NASA POWER PRECTOTCORR (grid cell, not a field station)</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Glass d={0.9}><div className="big">{(mx / Math.max(1, mn)).toFixed(1)}×</div><div>swing in season rain at the same place ({Math.round(mn)}–{Math.round(mx)} mm). An “average year” hides it.</div></Glass>
            <Glass d={1.1}><div className="big">30–84%</div><div>of studied site-seasons where fertilizer paid off in East Africa — inputs don’t always pay <span className="muted">(Sileshi et al. 2022)</span>.</div></Glass>
            <Glass d={1.3}><div className="big" style={{ fontSize: '1.6rem' }}>Patchy records</div><div>Past crops, doses and dates live in memory — and timing matters as much as totals.</div></Glass>
          </div>
        </div>
      </>
    ) },
    { id: 'cash', kicker: 'The cash gap', icon: <Wallet size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>An ideal rotation you can’t pay for before planting is not a plan.</motion.h2>
        <motion.p {...up(0.2)} style={{ maxWidth: 900 }}>Most tools rank crops by agronomy alone. Field Shift checks <b style={{ color: '#fff' }}>cash first</b>: funds minus a reserve, plus only confirmed, dated inflows — never assumed harvest income or credit.</motion.p>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: 30 }}>{engine && <CashBar plan={engine.baseline} cap={engine.baseline.budget.cap + engine.baseline.budget.inflowsTotal} cur={cur} />}</div>
        <motion.div {...up(1.6)} className="muted" style={{ fontSize: '.8rem' }}>{scenario.name} · synthetic demo prices · editable in the app</motion.div>
      </>
    ) },
    { id: 'who', kicker: 'Who it serves', icon: <Users size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Built for the people who plan at the edge of the field.</motion.h2>
        <div className="grid g3" style={{ marginTop: 18, flex: 1, alignContent: 'center' }}>
          {([
            [<Sprout size={22} />, 'Smallholder + extension worker', 'Rainfed groundnut–millet farms in Senegal’s groundnut basin. One field, tight cash, approximate records. Filled in together, in minutes.'],
            [<Tractor size={22} />, 'Family grain farm', 'Northern Kazakhstan steppe: wheat monoculture, short seasons, frost and dry Julys. Break crops or fallow — at what cash cost?'],
            [<Users size={22} />, 'Co-ops & input programmes', 'Agronomists and input-credit officers comparing many farms with the same transparent rules and printable plans.'],
          ] as const).map(([ic, t, d], k) => (
            <Glass key={t} d={0.3 + k * 0.15} style={{ padding: 22 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#10b981,#2563eb)', marginBottom: 14 }}>{ic}</div>
              <h3 style={{ fontSize: '1.15rem' }}>{t}</h3><p style={{ margin: 0 }}>{d}</p>
            </Glass>
          ))}
        </div>
      </>
    ) },
    { id: 'solution', kicker: 'Our solution', icon: <Sprout size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>One question, answered transparently.</motion.h2>
        <motion.p {...up(0.2)} style={{ fontSize: '1.2rem', color: '#fff', maxWidth: 1000 }}>“Given what I grew and applied before, my money now and the conditions here — <G>which next two-season plans can I realistically afford?</G>”</motion.p>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, marginTop: 'auto', marginBottom: 'auto' }}>
          {([
            [<MapIcon size={22} />, 'Farm & history', 'Map pin, area, last crops & outcomes, fertilizer, soil'],
            [<Wallet size={22} />, 'Resources', 'Cash, reserve, inflows, labor, seed, market, irrigation, 1 priority'],
            [<Scale size={22} />, 'Compare', 'Usual plan vs ≤ 2 feasible options, cost, timing, risk, reasons'],
            [<Microscope size={22} />, 'Evidence', 'NASA climate, season so far, forecast, satellite, past-season review'],
          ] as const).map(([ic, t, d], k, arr) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <Glass d={0.4 + k * 0.2} style={{ flex: 1, height: '100%', padding: 20 }}>
                <div className="spread"><span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: '2rem', color: '#6ee7b7' }}>{k + 1}</span><span style={{ color: '#93c5fd' }}>{ic}</span></div>
                <h3 style={{ marginTop: 10 }}>{t}</h3><p style={{ margin: 0, fontSize: '.92rem' }}>{d}</p>
              </Glass>
              {k < arr.length - 1 && <motion.div {...fade(0.6 + k * 0.2)} style={{ color: '#5d6c86' }}><ArrowRight size={22} /></motion.div>}
            </div>
          ))}
        </div>
      </>
    ) },
    { id: 'fusion', kicker: 'Data fusion', icon: <Layers size={14} />, body: (<><motion.h2 {...up(0.1)}>NASA Earth data + ground truth → explainable plans</motion.h2><FusionDiagram /></>) },
    { id: 'sow', kicker: 'Science 1 · When would you sow?', icon: <Sun size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Every past year gets its own realistic sowing date.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 28, flex: 1, alignItems: 'center' }}>
          <motion.div {...fade(0.2)}><SowingVisual /></motion.div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Glass d={0.5}><b><CloudRain size={16} style={{ verticalAlign: -3 }} /> Sahel & tropics</b><p style={{ margin: '6px 0 0' }}>Agronomic rain onset (Sivakumar 1988): first 3-day rain ≥ 20 mm with no dry spell over 7 days in the next 30.</p></Glass>
            <Glass d={0.7}><b><Thermometer size={16} style={{ verticalAlign: -3 }} /> Temperate</b><p style={{ margin: '6px 0 0' }}>Sow when the 5-day mean air temperature reaches the crop’s threshold — never before the usual last frost for frost-sensitive crops.</p></Glass>
            <Glass d={0.9}><b><Eye size={16} style={{ verticalAlign: -3 }} /> Why it matters</b><p style={{ margin: '6px 0 0' }}>Changing the window from Jun–Oct to Jul–Sep turns “20 of 25 years with a 10-day dry spell” into “1 of 25”. Dates beat averages.</p></Glass>
          </div>
        </div>
      </>
    ) },
    { id: 'bucket', kicker: 'Science 2 · Will the crop get enough water?', icon: <Droplets size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>A daily soil-water bucket, replayed over 25 real seasons.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 28, flex: 1, alignItems: 'center' }}>
          <motion.div {...fade(0.2)}><Bucket /></motion.div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Glass d={0.4}><b>1 · Demand</b><p style={{ margin: '6px 0 0' }}>FAO-56 Penman–Monteith ET₀ from NASA POWER temperature, humidity, wind and radiation × the crop curve Kc.</p></Glass>
            <Glass d={0.6}><b>2 · Supply</b><p style={{ margin: '6px 0 0' }}>Daily NASA rain fills the root zone; its size comes from SoilGrids texture (Saxton & Rawls) or the farmer’s own soil knowledge.</p></Glass>
            <Glass d={0.8}><b>3 · Yield response</b><p style={{ margin: '6px 0 0' }}>FAO-66: <span style={{ fontFamily: 'var(--mono)', color: '#fff' }}>1 − Ya/Ym = Ky (1 − ETa/ETc)</span>. Result: a range of outcomes, from bad years to good — not a single guess.</p></Glass>
          </div>
        </div>
      </>
    ) },
    { id: 'funnel', kicker: 'The decision engine', icon: <Calculator size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>From every possible rotation to two you can trust.</motion.h2>
        <motion.p {...up(0.2)}>Deterministic rules and published formulas — no black box, no LLM in the decision path. Every exclusion keeps its reason code.</motion.p>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {engine && <Funnel steps={[
            ['Rotations screened', engine.allPlans.length + 1, 'every 2-season pair in the pack'],
            ['Pass rotation & constraint rules', engine.allPlans.filter((p) => p.eligible).length, 'return intervals, disease groups, seed, labor, climate'],
            ['Affordable at every due date', engine.allPlans.filter((p) => p.feasible).length, 'funds − reserve + confirmed inflows'],
            ['Shown, ranked by your priority', engine.alternatives.length, `plus your usual plan, always shown`],
          ]} />}
        </div>
      </>
    ) },
    { id: 'result', kicker: `Live result · ${scenario.name}`, icon: <BadgeCheck size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>{engine?.baseline.budget.status === 'affordable' ? 'The usual plan fits — and here is how the alternatives compare.' : 'The usual plan doesn’t fit the budget. Two that do:'}</motion.h2>
        <div className="grid g3" style={{ marginTop: 14, flex: 1, alignContent: 'center' }}>{plans.map((p, k) => <PlanTile key={p.id} p={p} cur={cur} d={0.3 + k * 0.2} />)}</div>
        <motion.div {...up(1.2)} className="row" style={{ gap: 18, fontSize: '.85rem', color: '#c3cee0' }}>
          <span><Check size={14} color="#6ee7b7" /> Change a price, the budget or seed availability → results update instantly</span>
          <span><Check size={14} color="#6ee7b7" /> Printable report for the farmer</span>
        </motion.div>
      </>
    ) },
    { id: 'honest', kicker: 'Validity', icon: <BadgeCheck size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Honest by construction.</motion.h2>
        <div className="grid g3" style={{ marginTop: 14, flex: 1, alignContent: 'center' }}>
          <Glass d={0.3}><b style={{ color: '#93c5fd' }}><Satellite size={16} style={{ verticalAlign: -3 }} /> Observed</b><p style={{ margin: '8px 0 0' }}>NASA POWER rain, temperature, humidity, wind, radiation and soil wetness; GIBS satellite layers. Labeled as regional grid data.</p></Glass>
          <Glass d={0.45}><b style={{ color: '#c4b5fd' }}><Calculator size={16} style={{ verticalAlign: -3 }} /> Modeled</b><p style={{ margin: '8px 0 0' }}>ET₀, sowing dates, soil water, water-limited yield, revenue range — conditional historical scenarios, never forecasts.</p></Glass>
          <Glass d={0.6}><b style={{ color: '#fcd34d' }}><FlaskConical size={16} style={{ verticalAlign: -3 }} /> Farmer or synthetic</b><p style={{ margin: '8px 0 0' }}>History, budget and prices from the farmer; demo prices & farms are labeled synthetic until replaced.</p></Glass>
          <Glass d={0.75} style={{ gridColumn: 'span 2' }}><b><Check size={16} color="#6ee7b7" style={{ verticalAlign: -3 }} /> 37 automated tests + a live satellite cross-check</b><p style={{ margin: '8px 0 0' }}>Reproduce the archived NASA query exactly (9,131 records; Jun–Oct 2002 = 308.92 mm; 2009 = 975.63 mm), the FAO-56 textbook ET₀ example, budget boundaries (900 ✓ / 900.01 ✕) and “no affordable plan ever breaks cash timing”. In the app, the POWER-driven water model is compared with MODIS greenness at the field (Bambey: r = 0.55 over 10 seasons).</p></Glass>
          <Glass d={0.9}><b><Ban size={16} color="#fca5a5" style={{ verticalAlign: -3 }} /> Never claimed</b><p style={{ margin: '8px 0 0' }}>Guaranteed yields or profit · why a crop failed · fertilizer doses · soil N–P–K from purchases.</p></Glass>
        </div>
      </>
    ) },
    { id: 'impact', kicker: 'Impact & next steps', icon: <Globe2 size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>From one field to a cooperative — anywhere on Earth.</motion.h2>
        <div className="grid g3" style={{ marginTop: 8 }}>
          {([[<Globe2 size={20} />, 'Global', '14 regional farming systems (one- and two-season) on 6 continents + a global fallback; local currency & FAOSTAT prices for 240 countries.'], [<WifiOff size={20} />, '≈ $0 to run', 'Static web app, offline after first load, free hosting. Data stays on the device.'], [<FileDown size={20} />, 'Shareable', 'Printable plan with sources for farmers, extension workers and lenders.']] as const).map(([ic, t, d], k) => (
            <Glass key={t} d={0.3 + k * 0.15}><div style={{ color: '#6ee7b7' }}>{ic}</div><div className="big" style={{ fontSize: '2rem', marginTop: 6 }}>{t}</div><p style={{ margin: '6px 0 0' }}>{d}</p></Glass>
          ))}
        </div>
        <motion.div {...up(0.9)} style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '6%', right: '6%', top: 9, height: 2, background: 'linear-gradient(90deg,#10b981,#3b82f6)' }} />
          {[['Now', 'Working prototype, 14 regional packs, 37 tests'], ['Next 90 days', 'Pilot: 3–5 farmer interviews, agronomist review of every rule, dated local price pack'], ['v2', 'French · Wolof · Kazakh · Russian, SMS summary, NDVI time series per field'], ['Scale', 'Co-op dashboards & input-credit programmes; more regional packs']].map(([t, d], k) => (
            <div key={t} style={{ position: 'relative', padding: '0 10px', textAlign: 'center' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: k === 0 ? '#10b981' : '#0b1d36', border: '3px solid #34d399', margin: '0 auto 10px' }} />
              <b>{t}</b><p style={{ fontSize: '.85rem', margin: '4px 0 0' }}>{d}</p>
            </div>
          ))}
        </motion.div>
      </>
    ) },
  ];
  const SUB = ['title', 'problem', 'solution', 'fusion', 'result', 'honest', 'impact'];
  const slides = cut === 'full' ? all : all.filter((s) => SUB.includes(s.id));
  const n = slides.length;
  const idx = Math.min(i, n - 1);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') setI((x) => Math.min(n - 1, x + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI((x) => Math.max(0, x - 1));
      if (e.key === 'Escape') go('overview');
      if (e.key === 'f') document.documentElement.requestFullscreen?.();
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [go, n]);
  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => { window.print(); setPrinting(false); }, 3200); // let entrance animations finish
    return () => clearTimeout(t);
  }, [printing]);

  if (printing) {
    return (
      <div className="pitch-print">
        <style>{`@media print { @page { size: 1280px 720px; margin: 0; } body { background: #070d1a !important; } } .pitch-print .slide { width: 1280px; height: 720px; border-radius: 0; box-shadow: none; page-break-after: always; break-after: page; } .pitch-print * { animation: none !important; }`}</style>
        {slides.map((s, k) => <Slide key={s.id} n={k + 1} total={n} kicker={s.kicker} icon={s.icon}>{s.body}</Slide>)}
      </div>
    );
  }

  return (
    <div className="pitch">
      <div className="pitch-stage">
        <AnimatePresence mode="wait">
          <motion.div key={slides[idx].id + cut} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.01 }} transition={{ duration: 0.35 }} style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
            <Slide n={idx + 1} total={n} kicker={slides[idx].kicker} icon={slides[idx].icon}>{slides[idx].body}</Slide>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="pitch-bar">
        <div className="row">
          <button className="btn sm" onClick={() => go('overview')}><X size={14} /> Exit</button>
          <div className="seg" style={{ background: '#0d1628' }}>
            <button className={cut === 'full' ? 'on' : ''} style={{ color: cut === 'full' ? '#070d1a' : '#8d9ab0' }} onClick={() => { setCut('full'); setI(0); }}>Full story · 12</button>
            <button className={cut === 'submission' ? 'on' : ''} style={{ color: cut === 'submission' ? '#070d1a' : '#8d9ab0' }} onClick={() => { setCut('submission'); setI(0); }}>Submission cut · 7</button>
          </div>
        </div>
        <div className="progress">{slides.map((s, k) => <i key={s.id} className={k === idx ? 'on' : ''} onClick={() => setI(k)} title={s.kicker} />)}</div>
        <div className="row">
          <button className="btn sm" onClick={() => setPrinting(true)} title="Print every slide, one per page (save as PDF)"><FileDown size={14} /> PDF</button>
          <button className="btn sm" onClick={() => setI((v) => Math.max(0, v - 1))}><ChevronLeft size={14} /></button>
          <button className="btn sm on" onClick={() => setI((v) => Math.min(n - 1, v + 1))}>Next <ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}
