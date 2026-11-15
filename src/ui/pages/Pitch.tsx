import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, Ban, BookMarked, Calculator, Check, ChevronLeft, ChevronRight, CloudRain, Droplets, Eye, FileDown, FlaskConical, Globe2, Layers, Leaf,
  NotebookPen, Satellite, Shovel, Sprout, Tractor, Users, Wallet, WifiOff, X, Sun, Thermometer,
  Languages, Bot, Mic, LayoutDashboard, Cpu, Rocket, Database, Workflow, Target, Code,
} from 'lucide-react';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import { seasonEndOf } from './season';
import { CROPS } from '../../data/crops';
import { fmtMoney } from '../../domain/units';
import { addDays, dayIndex, fmtDayMonth } from '../../domain/dates';
import { rainOnset, temperatureSowing, yearlyWindow } from '../../weather/indicators';
import { BrandMark } from '../components/Logo';
import { OrbitVisual } from '../components/OrbitVisual';
import { ThemeToggle } from '../components/common';
import { CAT_TOKEN, SeasonRainChart, useChartTheme } from '../components/charts';
import { BEST_FIT, CASH_CAPTION, PlanCard, tradeOffText } from './Compare';
import { weightsSummary } from '../components/PrioritySliders';
import { HindcastChart } from '../components/Hindcast';
import { allHindcasts } from '../../data/hindcast/hindcast';
import { TEAM, TEAM_NAME, TEAM_PROFILES } from '../../data/team';
import type { PlanResult } from '../../engine/plan';
import type { PlanStress } from '../../engine/whatif';
import { useDrierHotter } from '../components/stress';

const ease = [0.2, 0.7, 0.2, 1] as const;
const up = (d = 0) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: d, ease } });
const fade = (d = 0) => ({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay: d } });
/** Key content: fully visible within ≈ 0.4 s of the slide appearing. */
const quick = (d = 0) => ({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay: d } });

function Slide({ n, total, kicker, icon, title, children }: { n: number; total: number; kicker: string; icon?: ReactNode; title?: boolean; children: ReactNode }) {
  return (
    <div className={`slide ${title ? 'title-slide' : ''}`}>
      <motion.div className="kicker" {...up(0)}>{icon}{kicker}</motion.div>
      {children}
      <div className="foot"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BrandMark size={18} /> Field Shift · NASA Space Apps 2026 · AI-assisted · built with Claude (Anthropic)</span><span>{n} / {total}</span></div>
    </div>
  );
}

/** Highlighted phrase in a slide title (brand ink; no gradient text). */
const G = ({ children }: { children: ReactNode }) => <span className="hl">{children}</span>;

/** A grouped block on a slide: surface-2 fill, no border (never a card in a card). */
function Panel({ children, d = 0, style }: { children: ReactNode; d?: number; style?: React.CSSProperties }) {
  return <motion.div className="boxed" {...up(d)} style={style}>{children}</motion.div>;
}

// ---------- visuals ----------
function CashBar({ plan, cap, cur }: { plan: PlanResult; cap: number; cur: string }) {
  const t = useChartTheme();
  const total = plan.budget.totalCash;
  const scaleMax = Math.max(total, cap) * 1.12;
  let acc = 0;
  return (
    <div>
      <div className="cashbar">
        {Object.keys(CAT_TOKEN).map((c, i) => {
          const v = plan.budget.lines.filter((l) => l.cash && l.category === c).reduce((a, l) => a + (l.total ?? 0), 0);
          if (!v) return null;
          const left = (acc / scaleMax) * 100; acc += v;
          return <motion.div key={c} className="seg-fill" title={c} initial={{ width: 0 }} animate={{ width: `${(v / scaleMax) * 100}%` }} transition={{ duration: 0.4, delay: 0.3 + i * 0.12, ease }} style={{ left: `${left}%`, background: t[CAT_TOKEN[c]] }}>{v / scaleMax > 0.1 ? c : ''}</motion.div>;
        })}
        <div className="cap" style={{ left: `${(cap / scaleMax) * 100}%` }} />
        <div className="cap-label" style={{ left: `${(cap / scaleMax) * 100}%` }}>budget {fmtMoney(cap, cur)}</div>
      </div>
      <div className="row" style={{ marginTop: 24, gap: 48 }}>
        <div><div className="muted">Usual plan cash cost</div><div className="num-xl">{fmtMoney(total, cur)}</div></div>
        <motion.div {...up(1.2)}><div className="muted">{plan.budget.headroom < 0 ? 'Over budget' : 'Left in budget'}</div><div className={`num-xl ${plan.budget.headroom < 0 ? 'bad-t' : 'good-t'}`}>{plan.budget.headroom < 0 ? '−' : '+'}{fmtMoney(Math.abs(plan.budget.headroom), cur)}</div></motion.div>
      </div>
    </div>
  );
}

function FusionDiagram() {
  const t = useChartTheme();
  const reduce = useReducedMotion();
  const left: [ReactNode, string, string][] = [[<CloudRain size={18} />, 'NASA POWER', 'rain, heat, wind, sun, 2001→now, any point'], [<Droplets size={18} />, 'SMAP L4 · POWER GWETROOT', 'soil moisture now vs normal'], [<Leaf size={18} />, 'MODIS NDVI · land cover', 'your field’s greenness since 2000'], [<Satellite size={18} />, 'GRACE · EONET · IMERG', 'groundwater trend, hazards, rain']];
  const right: [ReactNode, string, string][] = [[<NotebookPen size={18} />, 'Crop & fertilizer history', 'farmer records'], [<Wallet size={18} />, 'Budget + FAOSTAT prices', 'cash, reserve, real crop prices, FX'], [<Shovel size={18} />, 'SoilGrids + farmer texture', 'water-holding capacity'], [<BookMarked size={18} />, 'Regional rule pack', 'calendars, rotations, sources']];
  const out = ['Feasible plans', 'Cost & cash timing', 'Climate risk range', 'Reasons & sources'];
  const tile = (side: 'l' | 'r', [i, title, s]: [ReactNode, string, string], k: number) => (
    <motion.div key={title} initial={{ opacity: 0, x: side === 'l' ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + k * 0.08 + (side === 'r' ? 0.3 : 0), duration: 0.3, ease }}
      className={`boxed fusion-tile ${side === 'l' ? 'nasa' : ''}`}>
      <span className="ico">{i}</span>
      <div><b>{title}</b><div className="muted" style={{ fontSize: 13 }}>{s}</div></div>
    </motion.div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr', gap: 16, alignItems: 'center', flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div className="chip nasa" style={{ alignSelf: 'flex-start' }}>NASA</div>{left.map((x, k) => tile('l', x, k))}</div>
      <div style={{ position: 'relative', height: '100%', minHeight: 260, display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 200 300" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} aria-hidden>
          {[40, 110, 180, 250].map((y, k) => (
            <g key={y}>
              <motion.path d={`M 0 ${y} C 50 ${y}, 60 150, 100 150`} stroke={t.accent} strokeOpacity={0.6} strokeWidth={1.5} fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.4 + k * 0.08, duration: 0.5 }} />
              <motion.path d={`M 200 ${y} C 150 ${y}, 140 150, 100 150`} stroke={t.c4} strokeOpacity={0.7} strokeWidth={1.5} fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.7 + k * 0.08, duration: 0.5 }} />
            </g>
          ))}
          <circle cx={100} cy={150} r={54} fill={t.surface} stroke={t.border} strokeDasharray="4 5" />
        </svg>
        <motion.div initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, duration: 0.3 }} style={{ textAlign: 'center', position: 'relative', display: 'grid', justifyItems: 'center' }}>
          <BrandMark size={48} />
          <div style={{ fontWeight: 600, marginTop: 6, fontSize: 13 }}>Field Shift engine</div>
        </motion.div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div className="chip" style={{ alignSelf: 'flex-end' }}>Farmer & local</div>{right.map((x, k) => tile('r', x, k))}</div>
      <motion.div {...up(1.3)} style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        {out.map((o) => <span key={o} className="badge good" style={{ fontSize: 14, padding: '6px 12px' }}><Check />{o}</span>)}
      </motion.div>
    </div>
  );
}

function SowingVisual() {
  const { data, engine } = useApp();
  const t = useChartTheme();
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
      <svg viewBox={`0 0 ${W} ${H + 26}`} width="100%" role="img" aria-label="Daily NASA POWER series with the detected sowing date">
        <line x1={0} x2={W} y1={H} y2={H} stroke={t.border} />
        {view.kind === 'rain' ? view.vals.map((v, k) => (
          <motion.rect key={k} x={k * bw + 1} width={bw - 2} rx={2} fill={k >= view.mark && k < view.mark + 3 && view.mark >= 0 ? t.c3 : t.c1} initial={{ y: H, height: 0 }} animate={{ y: y(v), height: H - y(v) }} transition={{ delay: 0.2 + k * 0.006, duration: 0.3 }} />
        )) : (
          <>
            <motion.polyline points={view.vals.map((v, k) => `${k * bw + bw / 2},${y(v)}`).join(' ')} fill="none" stroke={t.c2} strokeWidth={2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 0.8 }} />
            <line x1={0} x2={W} y1={y(view.thr!)} y2={y(view.thr!)} stroke={t.text} strokeWidth={1.5} strokeDasharray="5 5" />
            <text x={W - 4} y={y(view.thr!) - 6} textAnchor="end" fill={t.text} fontSize={12}>{view.crop} sowing threshold {view.thr} °C</text>
          </>
        )}
        {view.mark >= 0 && <motion.g {...fade(0.9)}>
          <line x1={view.mark * bw + bw / 2} x2={view.mark * bw + bw / 2} y1={10} y2={H} stroke={t.brand} strokeWidth={2} />
          <rect x={view.mark * bw + bw / 2 - 64} y={0} width={128} height={24} rx={6} fill={t.brand} />
          <text x={view.mark * bw + bw / 2} y={16} textAnchor="middle" fill={t.surface} fontWeight={600} fontSize={12}>sow ≈ {view.label} {view.year}</text>
        </motion.g>}
        {[0, 20, 40, 60].map((k) => <text key={k} x={k * bw} y={H + 20} fill={t.axis} fontSize={12}>{fmtDayMonth(addDays(view.startISO, k))}</text>)}
      </svg>
      <div className="muted" style={{ fontSize: 13 }}>{view.kind === 'rain' ? `Daily NASA POWER rain from ${fmtDayMonth(view.startISO)} ${view.year}; green = first 3-day total ≥ 20 mm with no >7-day dry spell after it.` : `Daily NASA POWER mean air temperature from ${fmtDayMonth(view.startISO)} ${view.year}, sown when the 5-day mean passes the crop threshold (and after the usual last frost for frost-sensitive crops).`}</div>
    </div>
  );
}

function Bucket() {
  const t = useChartTheme();
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 360 320" width="100%" role="img" aria-label="Soil-water bucket: rain fills it, evapotranspiration and drainage empty it">
      <rect x={90} y={80} width={180} height={200} rx={8} fill={t.surface2} stroke={t.border} />
      <motion.rect x={92} width={176} rx={6} fill={t.c1} opacity={0.55} initial={{ y: 200, height: 78 }} animate={reduce ? { y: 200, height: 78 } : { y: [200, 130, 165, 200, 238, 200], height: [78, 148, 113, 78, 40, 78] }} transition={{ duration: 7, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }} />
      <line x1={80} x2={280} y1={100} y2={100} stroke={t.text} strokeDasharray="5 4" /><text x={286} y={104} fill={t.text} fontSize={12}>field capacity</text>
      <line x1={80} x2={280} y1={190} y2={190} stroke={t.text} strokeDasharray="5 4" /><text x={286} y={186} fill={t.text} fontSize={12}>stress starts</text><text x={286} y={200} fill={t.muted} fontSize={12}>(p × TAW)</text>
      <line x1={80} x2={280} y1={270} y2={270} stroke={t.text} strokeDasharray="5 4" /><text x={286} y={274} fill={t.text} fontSize={12}>wilting point</text>
      <g>
        <path d="M150 20 v40 M180 10 v50 M210 20 v40" stroke={t.c1} strokeWidth={3} strokeLinecap="round" />
        <path d="M140 52 l10 12 l10 -12 M170 52 l10 12 l10 -12 M200 52 l10 12 l10 -12" stroke={t.c1} strokeWidth={2.5} fill="none" />
        <text x={182} y={8} textAnchor="middle" fill={t.accent} fontSize={12} fontWeight={600}>RAIN (NASA POWER)</text>
      </g>
      <g>
        <path d="M40 150 q10 -20 0 -40 q-10 -20 0 -40" stroke={t.c4} strokeWidth={2.5} fill="none" />
        <text x={40} y={170} textAnchor="middle" fill={t.text} fontSize={12} fontWeight={600}>ET</text>
        <text x={40} y={184} textAnchor="middle" fill={t.muted} fontSize={12}>Kc × ET₀</text>
      </g>
      <path d="M180 284 v26" stroke={t.muted} strokeWidth={2.5} /><path d="M172 302 l8 10 l8 -10" stroke={t.muted} strokeWidth={2.5} fill="none" />
      <text x={200} y={312} fill={t.muted} fontSize={12}>drainage</text>
    </svg>
  );
}

function Funnel({ steps }: { steps: [string, number, string][] }) {
  const max = steps[0][1] || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map(([label, n, note], i) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}><b>{label}</b><div className="muted" style={{ fontSize: 13 }}>{note}</div></div>
          <div className="funnel-track">
            <motion.div className={`funnel-fill ${i === steps.length - 1 ? 'last' : ''}`} initial={{ width: 0 }} animate={{ width: `${Math.max(6, (n / max) * 100)}%` }} transition={{ delay: 0.2 + i * 0.15, duration: 0.4, ease }}>{n}</motion.div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Slide 3: the live Compare result in miniature, with three callouts on the rows that matter. */
function MiniCompare({ plans, cur, stress }: { plans: PlanResult[]; cur: string; stress: Map<string, PlanStress> | null }) {
  const pairs = plans[0]?.outcome.pairs ?? 0;
  const call = (k: number, title: string, d: string, delay: number) => (
    <motion.div className="mc-call" {...quick(delay)}>
      <span className="mc-n">{k}</span>
      <div><b>{title}</b><span>{d}</span></div>
      <ArrowRight size={18} className="mc-arrow" aria-hidden />
    </motion.div>
  );
  return (
    <motion.div {...quick(0)} className="mini-compare">
      <div className="mc-calls mc-r3">{call(1, 'Your budget', 'cost against cash you can spend', 0.1)}</div>
      <div className="mc-calls mc-r4">
        {call(2, `NASA ${pairs}-season replay`, `${pairs} consecutive season pairs`, 0.15)}
        {call(3, 'Stress-test: drier & hotter', '−15% rain, +2 °C', 0.2)}
      </div>
      {plans.map((p, k) => <PlanCard key={p.id} p={p} cur={cur} label={p.isBaseline ? 'Usual plan' : k === 1 ? BEST_FIT : p.label} tone={k === 1 ? 'brand' : undefined} best={k === 1} compact risk={stress?.get(p.id) ?? null} />)}
    </motion.div>
  );
}

/** Slide 5: where Field Shift sits against similar tools (placed by zone from each tool's public pages, Nov 2026). */
function PositionMap() {
  const t = useChartTheme();
  const x0 = 70, y0 = 10, w = 440, h = 300, mx = x0 + w / 2, my = y0 + h / 2;
  const item = (x: number, y: number, label: string) => (
    <g key={label}><circle cx={x} cy={y - 4} r={4} fill="none" stroke={t.axis} strokeWidth={1.25} /><text x={x + 10} y={y} fill={t.text} fontSize={13}>{label}</text></g>
  );
  return (
    <svg viewBox="0 0 520 360" width="100%" role="img" aria-label="Positioning map: only Field Shift both checks cash and computes each plan's weather risk">
      <rect x={mx} y={y0} width={w / 2} height={h / 2} fill={t.brand} fillOpacity={0.1} />
      <rect x={x0} y={y0} width={w} height={h} fill="none" stroke={t.border} />
      <line x1={mx} x2={mx} y1={y0} y2={y0 + h} stroke={t.border} /><line x1={x0} x2={x0 + w} y1={my} y2={my} stroke={t.border} />
      <text x={x0 + 10} y={y0 + 20} fill={t.muted} fontSize={11.5}>Money, risk left to the reader</text>
      {item(x0 + 18, y0 + 50, 'E-PICSA (Zambia, Malawi)')}{item(x0 + 18, y0 + 72, 'PICSA paper method')}{item(x0 + 18, y0 + 94, 'Crop Planner (UK)')}
      <text x={mx + 10} y={y0 + 20} fill={t.muted} fontSize={11.5}>Money + computed risk</text>
      <circle cx={mx + 22} cy={y0 + 56} r={7} fill={t.brand} /><text x={mx + 36} y={y0 + 61} fill={t.text} fontSize={15} fontWeight={700}>Field Shift</text>
      <text x={x0 + 10} y={my + 20} fill={t.muted} fontSize={11.5}>Neither</text>
      {item(x0 + 18, my + 46, 'Precision Development (SMS)')}{item(x0 + 18, my + 68, 'FarmerChat (AI chat)')}{item(x0 + 18, my + 90, 'Cropin · OneSoil')}{item(x0 + 18, my + 112, 'ENACTS climate maps')}
      <text x={mx + 10} y={my + 20} fill={t.muted} fontSize={11.5}>Risk, no money</text>
      <text x={mx + 18} y={my + 50} fill={t.muted} fontSize={13}>No tool found</text>
      <text x={x0} y={y0 + h + 20} fill={t.muted} fontSize={11.5}>Past weather: none or graphs</text>
      <text x={x0 + w} y={y0 + h + 20} textAnchor="end" fill={t.muted} fontSize={11.5}>computed for each plan →</text>
      <text transform={`rotate(-90 20 ${my})`} x={20} y={my} textAnchor="middle" fill={t.muted} fontSize={11.5}>Money: not considered → budget / cash check</text>
    </svg>
  );
}

// ---------- deck ----------
export function PitchPage({ go }: { go: (r: Route) => void }) {
  const { engine, data, scenario } = useApp();
  const cut = 'pitch';
  const [i, setI] = useState(0);
  const [printing, setPrinting] = useState(false);
  const rows = useMemo(() => (data.series && engine ? yearlyWindow(data.series, engine.window.earliest, seasonEndOf(engine)) : []), [data.series, engine]);
  const mn = rows.length ? Math.min(...rows.map((r) => r.windowRain)) : 0, mx = rows.length ? Math.max(...rows.map((r) => r.windowRain)) : 0;
  const minRow = rows.find((r) => r.windowRain === mn), maxRow = rows.find((r) => r.windowRain === mx);
  const cur = scenario.currency;
  const place = (scenario.location.label ?? '').split(',')[0] || 'this site';
  const plans = engine ? [engine.baseline, ...engine.alternatives] : [];
  const stress = useDrierHotter();
  const base = import.meta.env.BASE_URL;

  const all: { id: string; kicker: string; icon: ReactNode; body: ReactNode }[] = [
    { id: 'title', kicker: 'NASA Space Apps 2026 · Field Shift challenge', icon: <BadgeCheck size={14} />, body: (
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 32, alignItems: 'center' }}>
        <div>
          <motion.div {...up(0.1)} style={{ display: 'flex', alignItems: 'center', gap: 20 }}><BrandMark size={88} /><span style={{ fontWeight: 700, fontSize: 'clamp(36px, 5vw, 64px)', letterSpacing: '-.02em' }}>Field Shift</span></motion.div>
          <motion.h1 {...up(0.2)} style={{ margin: '24px 0 12px' }}><G>From space to soil.</G></motion.h1>
          <motion.p {...up(0.3)} style={{ maxWidth: 620 }}>Crop plans farmers can afford, tested against 25 years of NASA Earth data.</motion.p>
          <motion.p {...up(0.4)} className="quote" style={{ marginTop: 32 }}>by Team <b>{TEAM_NAME}</b></motion.p>
        </div>
        <motion.div {...fade(0.3)} style={{ height: 260 }}><OrbitVisual /></motion.div>
      </div>
    ) },
    { id: 'problem', kicker: 'The problem', icon: <CloudRain size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Every season, farmers bet their savings on the sky, before they know the rain.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 24, flex: 1, alignItems: 'center' }}>
          <motion.div {...fade(0.2)}>
            {rows.length > 0 && minRow && maxRow && <SeasonRainChart rows={rows} highlight={[minRow.year, maxRow.year]} height={210} />}
            <div className="muted" style={{ fontSize: 12 }}>Season rain by year at {place}, mm, NASA POWER (grid cell). Driest and wettest years highlighted.</div>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Panel d={0.3}><div className="num-xl" style={{ fontSize: 40 }}>{(mx / Math.max(1, mn)).toFixed(1)}×</div><p style={{ marginTop: 6, fontSize: 14 }}>swing in season rain at one place ({Math.round(mn)}–{Math.round(mx)} mm)</p></Panel>
            <Panel d={0.35}><div className="num-xl" style={{ fontSize: 40 }}>$170 B</div><p style={{ marginTop: 6, fontSize: 14 }}>yearly smallholder finance gap; 70% of need unmet (ISF Advisors 2019)</p></Panel>
            <Panel d={0.4}><div className="num-xl" style={{ fontSize: 40 }}>1 : 1,000+</div><p style={{ marginTop: 6, fontSize: 14 }}>extension agents to farmers in many countries (Fabregas et al., Science 2019)</p></Panel>
            <Panel d={0.45}><div className="num-xl" style={{ fontSize: 40 }}>608 M</div><p style={{ marginTop: 6, fontSize: 14 }}>farms worldwide, 84% under 2 ha: the market (FAO)</p></Panel>
          </div>
        </div>
        <motion.div {...up(0.5)} style={{ marginTop: 12, marginBottom: 20 }}>
          <b style={{ fontSize: 15 }}>Why it happens</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 6 }}>
            {[['Rain decides', 'Rain-fed farms give 52% of world crop output (FAO 2025).'], ['Cash comes before rain', 'Inputs are paid before sowing; credit and insurance rarely reach smallholders.'], ['Advice is scarce', 'Generic tips, no check of what a plan costs or how it fails in a bad year.'], ['Markets push one crop', 'Wheat ≈ 56% of Kazakhstan’s sown area (2024 plan).']].map(([h, d]) => (
              <div key={h} style={{ fontSize: 13, lineHeight: 1.35 }}><b className="ink">{h}</b><div className="muted">{d}</div></div>
            ))}
          </div>
        </motion.div>
      </>
    ) },
    { id: 'cash', kicker: 'The cash gap', icon: <Wallet size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>An ideal rotation you can’t pay for before planting is not a plan.</motion.h2>
        <motion.p {...up(0.2)} style={{ maxWidth: 900 }}>Most tools rank crops by agronomy alone. Field Shift checks <b>cash first</b>: funds minus a reserve; never assumed harvest income or credit.</motion.p>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: 32 }}>{engine && <CashBar plan={engine.baseline} cap={engine.baseline.budget.cap} cur={cur} />}</div>
        <motion.div {...up(1)} className="muted" style={{ fontSize: 13 }}>{scenario.name} · synthetic demo prices · editable in the app</motion.div>
      </>
    ) },
    { id: 'who', kicker: 'Who it serves', icon: <Users size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Built for the people who plan at the edge of the field.</motion.h2>
        <div className="grid g3" style={{ marginTop: 16, flex: 1, alignContent: 'center' }}>
          {([
            [<Sprout size={22} />, 'Smallholder + extension worker', 'Rainfed groundnut–millet farms in Senegal’s groundnut basin. One field, tight cash, approximate records. Filled in together, in minutes.'],
            [<Tractor size={22} />, 'Family grain farm', 'Northern Kazakhstan steppe: wheat monoculture, short seasons, frost and dry Julys. Break crops or fallow, at what cash cost?'],
            [<Users size={22} />, 'Co-ops & input programmes', 'Agronomists and input-credit officers comparing many farms with the same transparent rules and printable plans.'],
          ] as const).map(([ic, title, d], k) => (
            <Panel key={title} d={0.2 + k * 0.1} style={{ padding: 24 }}>
              <div className="slide-ico">{ic}</div>
              <h3 style={{ fontSize: 20, margin: '16px 0 8px' }}>{title}</h3><p>{d}</p>
            </Panel>
          ))}
        </div>
      </>
    ) },
    { id: 'solution', kicker: 'Our solution', icon: <Sprout size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Which next plans can I <G>afford</G>, and how do they hold up in a <G>bad year</G>?</motion.h2>
        <motion.p {...up(0.2)} style={{ fontSize: 15 }}><b className="ink">1</b> Pin the field · <b className="ink">2</b> Enter crops &amp; budget · <b className="ink">3</b> Compare affordable plans · <b className="ink">4</b> Print or share. Live for {place}:</motion.p>
        {engine && plans.length > 0 ? <MiniCompare plans={plans} cur={cur} stress={stress} /> : null}
      </>
    ) },
    { id: 'how', kicker: 'How it works', icon: <Cpu size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Published science in a free web app: no black box.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 16, flex: 1, alignItems: 'stretch' }}>
          <Panel d={0.2}><b className="row" style={{ gap: 6 }}><Database size={16} /> Data in</b>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 15 }}>
              <li><b className="ink">NASA POWER</b> daily weather since 2001</li>
              <li>NASA SMAP, MODIS, GRACE context</li>
              <li>SoilGrids soil · FAOSTAT prices</li>
              <li>The farmer’s crops and budget</li>
            </ul>
          </Panel>
          <Panel d={0.3}><b className="row" style={{ gap: 6 }}><Calculator size={16} /> The engine, for every candidate rotation</b>
            <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 15 }}>
              <li>Sowing date per past year (rain onset)</li>
              <li>Daily soil-water balance (FAO-56)</li>
              <li>Yield in 24 real season pairs (FAO-66)</li>
              <li>Cash check at every due date</li>
              <li>Rotation rules, then rank, with reasons</li>
            </ol>
          </Panel>
          <Panel d={0.4}><b className="row" style={{ gap: 6 }}><Code size={16} /> Stack</b>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 15 }}>
              <li>React + TypeScript + Vite</li>
              <li>Static site, GitHub Pages CI</li>
              <li>No backend; works offline</li>
              <li>180 automated tests</li>
            </ul>
          </Panel>
        </div>
        <motion.div {...up(0.5)} className="row" style={{ gap: 8, margin: '12px 0 20px', fontSize: 14, flexWrap: 'wrap' }}>
          <b className="row" style={{ gap: 6 }}><Workflow size={16} /> Process:</b>
          {['Brief & research', 'Spec + evidence register', 'Engine first, tested on archived NASA data & the FAO-56 example', 'UI + 16 regional packs', 'Hindcast vs real FAOSTAT yields'].map((s, k, a) => <span key={s} className="row" style={{ gap: 8 }}><span className="chip" style={{ fontSize: 13, padding: '3px 8px' }}>{s}</span>{k < a.length - 1 && <ArrowRight size={14} className="muted" />}</span>)}
        </motion.div>
      </>
    ) },
    { id: 'edge', kicker: 'Why it is better', icon: <Target size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Others show what grows. Field Shift shows what you can <G>afford</G>.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1, alignItems: 'center' }}>
          <motion.div {...fade(0.2)}><PositionMap /><div className="muted" style={{ fontSize: 12 }}>Placed from each tool’s public pages, Nov 2026. Nearest: E-PICSA shows rainfall history and budgets, but people read the risk.</div></motion.div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Panel d={0.3}><b className="ink">Affordability first</b><p style={{ marginTop: 4, fontSize: 14 }}>Plans that run out of cash before a due date are excluded, with the reason shown.</p></Panel>
            <Panel d={0.35}><b className="ink">Bad years, not averages</b><p style={{ marginTop: 4, fontSize: 14 }}>Each plan replayed through 24 real consecutive season pairs, plus a drier &amp; hotter test.</p></Panel>
            <Panel d={0.4}><b className="ink">Anywhere on Earth, day one</b><p style={{ marginTop: 4, fontSize: 14 }}>16 regional farming packs + global screening; no national data system needed.</p></Panel>
            <Panel d={0.45}><b className="ink">Every number traceable</b><p style={{ marginTop: 4, fontSize: 14 }}>Reason codes and sources on every plan; no AI in the decision; checked against real harvests.</p></Panel>
          </div>
        </div>
      </>
    ) },
    { id: 'next', kicker: 'What comes next', icon: <Rocket size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Next: every market, every language, every farmer.</motion.h2>
        <div className="grid g2" style={{ gap: 12, flex: 1, alignContent: 'center' }}>
          {([
            [<Languages size={20} />, 'Every market, its own language', 'French, Wolof, Kazakh, Russian, Uzbek, Portuguese, Swahili, Hindi… (today: English).'],
            [<Bot size={20} />, 'AI assistant', 'Explains each plan in plain words, using only the engine’s numbers.'],
            [<Mic size={20} />, 'Voice', 'Read-out and voice input for farmers who don’t read easily.'],
            [<LayoutDashboard size={20} />, 'Live data dashboard', 'Opt-in telemetry: plans compared and changed, by region, for co-ops and ministries.'],
          ] as const).map(([ic, h, d], k) => (
            <Panel key={h} d={0.2 + k * 0.07}><div className="row" style={{ gap: 8 }}><span className="muted">{ic}</span><b className="ink" style={{ fontSize: 18 }}>{h}</b><span className="chip" style={{ marginLeft: 'auto' }}>planned</span></div><p style={{ marginTop: 6, fontSize: 15 }}>{d}</p></Panel>
          ))}
        </div>
        <motion.div {...up(0.5)} className="timeline" style={{ marginBottom: 20 }}>
          {[['Now', 'Working prototype, 16 regional packs'], ['Next 90 days', 'Pilot with an NGO and a local agronomist; real local prices'], ['v2', 'Languages, voice, AI assistant'], ['Scale', 'Dashboard for co-ops, NGOs and governments']].map(([title, d], k) => (
            <div key={title}><i className={k === 0 ? 'on' : ''} /><b>{title}</b><p style={{ fontSize: 14, marginTop: 4 }}>{d}</p></div>
          ))}
        </motion.div>
      </>
    ) },
    { id: 'team', kicker: `Why us · Team ${TEAM_NAME}`, icon: <Users size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Builders, educators and founders: <G>Team {TEAM_NAME}</G>.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: 20, flex: 1, alignItems: 'center' }}>
          <div className="grid g3" style={{ gap: 12 }}>
            {TEAM_PROFILES.map((m, k) => (
              <Panel key={m.name} d={0.15 + k * 0.05}><b className="ink" style={{ fontSize: 18 }}>{m.name}</b><p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.4 }}>{m.line}</p></Panel>
            ))}
          </div>
          <motion.div {...quick(0.3)} className="qr-box">
            <img src={`${base}media/qr-live.svg`} alt="QR code for https://adrizh.github.io/AgroNASA/" width={160} height={160} style={{ width: 160, height: 160 }} />
            <span className="muted">Scan to try it</span>
          </motion.div>
        </div>
        <motion.div {...quick(0.4)} className="live-url">
          <span className="caption">Try it live</span>
          <a href="https://adrizh.github.io/AgroNASA/" target="_blank" rel="noopener noreferrer">adrizh.github.io/AgroNASA</a>
        </motion.div>
      </>
    ) },
    { id: 'fusion', kicker: 'Data fusion', icon: <Layers size={14} />, body: (<><motion.h2 {...up(0.1)}>NASA Earth data + ground truth → explainable plans</motion.h2><FusionDiagram /></>) },
    { id: 'sow', kicker: 'Science 1 · When would you sow?', icon: <Sun size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Every past year gets its own realistic sowing date.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 32, flex: 1, alignItems: 'center' }}>
          <motion.div {...fade(0.2)}><SowingVisual /></motion.div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Panel d={0.3}><b><CloudRain size={16} style={{ verticalAlign: -3 }} /> Sahel & tropics</b><p style={{ marginTop: 6 }}>Agronomic rain onset (Sivakumar 1988): first 3-day rain ≥ 20 mm with no dry spell over 7 days in the next 30.</p></Panel>
            <Panel d={0.4}><b><Thermometer size={16} style={{ verticalAlign: -3 }} /> Temperate</b><p style={{ marginTop: 6 }}>Sow when the 5-day mean air temperature reaches the crop’s threshold, never before the usual last frost for frost-sensitive crops.</p></Panel>
            <Panel d={0.5}><b><Eye size={16} style={{ verticalAlign: -3 }} /> Why it matters</b><p style={{ marginTop: 6 }}>Changing the window from Jun–Oct to Jul–Sep turns “20 of 25 years with a 10-day dry spell” into “1 of 25”. Dates beat averages.</p></Panel>
          </div>
        </div>
      </>
    ) },
    { id: 'bucket', kicker: 'Science 2 · Will the crop get enough water?', icon: <Droplets size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>A daily soil-water bucket, every season since 2001.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 32, flex: 1, alignItems: 'center' }}>
          <motion.div {...fade(0.2)}><Bucket /></motion.div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Panel d={0.3}><b>1 · Demand</b><p style={{ marginTop: 6 }}>FAO-56 Penman–Monteith ET₀ from NASA POWER temperature, humidity, wind and radiation × the crop curve Kc.</p></Panel>
            <Panel d={0.4}><b>2 · Supply</b><p style={{ marginTop: 6 }}>Daily NASA rain fills the root zone; its size comes from SoilGrids texture (Saxton & Rawls) or the farmer’s own soil knowledge.</p></Panel>
            <Panel d={0.5}><b>3 · Yield response</b><p style={{ marginTop: 6 }}>FAO-66: <span className="mono" style={{ fontSize: 'inherit' }}>1 − Ya/Ym = Ky (1 − ETa/ETc)</span>. Result: a range of outcomes, from bad years to good, not a single guess.</p></Panel>
          </div>
        </div>
      </>
    ) },
    { id: 'funnel', kicker: 'The decision engine', icon: <Calculator size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>From every possible rotation to two you can trust.</motion.h2>
        <motion.p {...up(0.2)}>Deterministic rules and published formulas: no black box, no LLM in the decision path. Every exclusion keeps its reason code.</motion.p>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {engine && <Funnel steps={[
            ['Rotations screened', engine.allPlans.length + 1, 'every 2-season pair in the pack'],
            ['Pass rotation & constraint rules', engine.allPlans.filter((p) => p.eligible).length, 'return intervals, disease groups, seed, labor, climate'],
            ['Affordable at every due date', engine.allPlans.filter((p) => p.feasible).length, 'funds − reserve'],
            ['Shown, ranked by your priorities', engine.alternatives.length, `plus your usual plan, always shown`],
          ]} />}
        </div>
      </>
    ) },
    { id: 'result', kicker: `Live result · ${scenario.name}`, icon: <BadgeCheck size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>{engine?.baseline.budget.status === 'affordable' ? 'The usual plan fits, and here is how the alternatives compare.' : 'The usual plan doesn’t fit the budget. Two that do:'}</motion.h2>
        <motion.div {...fade(0.2)} className="plan-row slide-plans" style={{ flex: 1, alignContent: 'center' }}>{plans.map((p, k) => <PlanCard key={p.id} p={p} cur={cur} label={p.isBaseline ? 'Your usual plan' : k === 1 ? BEST_FIT : p.label} sub={k === 1 ? `ranked by ${weightsSummary(scenario.weights)}` : undefined} tone={k === 1 ? 'brand' : undefined} best={k === 1} compact risk={stress?.get(p.id) ?? null} showNet />)}</motion.div>
        <motion.p {...fade(0.3)} className="muted" style={{ fontSize: 14, lineHeight: 1.4, margin: '8px 0' }}>{CASH_CAPTION}{engine && tradeOffText(engine.alternatives, cur) ? ` ${tradeOffText(engine.alternatives, cur)}` : ''}</motion.p>
        <motion.div {...up(0.4)} className="row" style={{ gap: 24, fontSize: 15 }}>
          <span className="row" style={{ gap: 6 }}><Check size={16} className="good-t" /> Change a price, the budget or seed availability and results update instantly</span>
          <span className="row" style={{ gap: 6 }}><Check size={16} className="good-t" /> Printable report for the farmer</span>
        </motion.div>
      </>
    ) },
    { id: 'honest', kicker: 'Validity', icon: <BadgeCheck size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Honest by construction.</motion.h2>
        <div className="grid g3" style={{ marginTop: 8, flex: 1, alignContent: 'center' }}>
          <Panel d={0.2}><span className="chip nasa"><Satellite /> Observed</span><p style={{ marginTop: 8, fontSize: 15 }}>NASA POWER rain, temperature, humidity, wind, radiation and soil wetness; GIBS satellite layers. Labeled as regional grid data.</p></Panel>
          <Panel d={0.3}><span className="chip"><Calculator /> Modeled</span><p style={{ marginTop: 8, fontSize: 15 }}>ET₀, sowing dates, soil water, water-limited yield, revenue range: conditional historical scenarios, never forecasts.</p></Panel>
          <Panel d={0.4}><span className="chip"><FlaskConical /> Farmer or synthetic</span><p style={{ marginTop: 8, fontSize: 15 }}>History, budget and prices from the farmer; demo prices and farms are labeled synthetic until replaced.</p></Panel>
          <Panel d={0.5} style={{ gridColumn: 'span 2' }}>{(() => {
            const hs = allHindcasts(), kz = hs.find((h) => h.c.key === 'KZ-wheat')!;
            const drought = hs.flatMap((h) => h.hits.filter((x) => x.hit).map((x) => x.year));
            return (<>
              <b><Check size={16} style={{ verticalAlign: -3 }} /> Hindcast against real harvests (FAOSTAT, detrended)</b>
              <HindcastChart h={kz} height={138} compact />
              <p style={{ marginTop: 2, fontSize: 13, lineHeight: 1.35 }}>Kazakhstan wheat r = {kz.r.toFixed(2)} (n = {kz.n}); {hs.filter((h) => h !== kz).map((h) => `${h.c.label.replace('Senegal · ', 'Senegal ')} r = ${h.r.toFixed(2)}`).join(', ')}. Drought years {[...new Set(drought)].sort().join(', ')} all fall in the model’s driest third. One grid cell vs a whole country is a weak test, and we say so.</p>
            </>);
          })()}</Panel>
          <Panel d={0.6}><b><Ban size={16} style={{ verticalAlign: -3 }} /> Never claimed</b><p style={{ marginTop: 8, fontSize: 15 }}>Guaranteed yields or profit · why a crop failed · fertilizer doses · soil N–P–K from purchases.</p><p style={{ marginTop: 14, fontSize: 15 }}><b><Check size={16} style={{ verticalAlign: -3 }} /> Tested</b><br />Automated tests reproduce the archived NASA query, the FAO-56 ET₀ worked example and every budget boundary.</p></Panel>
        </div>
      </>
    ) },
    { id: 'impact', kicker: 'Impact & next steps', icon: <Globe2 size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>From one field to a cooperative, anywhere on Earth.</motion.h2>
        <div className="impact-grid">
          <div style={{ minWidth: 0 }}>
            <div className="grid g3">
              {([[<Globe2 size={20} />, 'Global', '16 regional farming systems on 6 continents + a global fallback; FAOSTAT prices for 240 countries.'], [<WifiOff size={20} />, '≈ $0 to run', 'Static web app on free hosting. Demo farms work offline; other places are cached after the first download.'], [<FileDown size={20} />, 'Shareable', 'Printable plan with sources for farmers, extension workers and lenders.']] as const).map(([ic, title, d], k) => (
                <Panel key={title} d={0.05 + k * 0.05}><div className="row" style={{ gap: 8 }}><span className="muted">{ic}</span><b className="impact-t">{title}</b></div><p style={{ marginTop: 8, fontSize: 15 }}>{d}</p></Panel>
              ))}
            </div>
            <motion.div {...up(0.15)} className="timeline">
              {[['Now', 'Working prototype, 16 regional packs, automated tests'], ['Next 90 days', 'Pilot: 3–5 farmer interviews, agronomist review of every rule, dated local price pack'], ['v2', 'French · Wolof · Kazakh · Russian, SMS summary, NDVI per field'], ['Scale', 'Co-op dashboards & input-credit programmes']].map(([title, d], k) => (
                <div key={title}>
                  <i className={k === 0 ? 'on' : ''} />
                  <b>{title}</b><p style={{ fontSize: 14, marginTop: 4 }}>{d}</p>
                </div>
              ))}
            </motion.div>
          </div>
          <motion.div {...quick(0.1)} className="qr-box">
            <img src={`${base}media/qr-live.svg`} alt="QR code for https://adrizh.github.io/AgroNASA/" width={200} height={200} />
            <span className="muted">Scan to try it on a phone</span>
          </motion.div>
        </div>
        <motion.div {...quick(0.15)} className="live-url">
          <span className="caption">Try it live</span>
          <a href="https://adrizh.github.io/AgroNASA/" target="_blank" rel="noopener noreferrer">adrizh.github.io/AgroNASA</a>
          <span className="caption" style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>Team: {TEAM.join(' · ')}</span>
        </motion.div>
      </>
    ) },
  ];
  // Exactly seven slides, in the order the team asked for. Older slides stay defined above but are not shown.
  const PITCH = ['title', 'problem', 'solution', 'how', 'edge', 'next', 'team'];
  const slides = PITCH.map((id) => all.find((s) => s.id === id)!);
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
    const t = setTimeout(() => { window.print(); setPrinting(false); }, 2000); // let entrance animations finish
    return () => clearTimeout(t);
  }, [printing]);

  if (printing) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="pitch-print">
          <style>{`@media print { @page { size: 1280px 720px; margin: 0; } } .pitch-print .slide { width: 1280px; height: 720px; border-radius: 0; page-break-after: always; break-after: page; } .pitch-print * { animation: none !important; }`}</style>
          {slides.map((s, k) => <Slide key={s.id} n={k + 1} total={n} kicker={s.kicker} icon={s.icon} title={s.id === 'title'}>{s.body}</Slide>)}
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="pitch">
        <div className="pitch-stage">
          <AnimatePresence mode="wait">
            <motion.div key={slides[idx].id + cut} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
              <Slide n={idx + 1} total={n} kicker={slides[idx].kicker} icon={slides[idx].icon} title={slides[idx].id === 'title'}>{slides[idx].body}</Slide>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="pitch-bar">
          <div className="row">
            <button className="btn sm" onClick={() => go('overview')}><X /> Exit</button>
          </div>
          <div className="progress" role="tablist" aria-label="Slides">{slides.map((s, k) => <i key={s.id} role="tab" aria-selected={k === idx} aria-label={s.kicker} className={k === idx ? 'on' : ''} onClick={() => setI(k)} title={s.kicker} />)}</div>
          <div className="row">
            <ThemeToggle />
            <button className="btn sm" onClick={() => setPrinting(true)} title="Print every slide, one per page (save as PDF)"><FileDown /> PDF</button>
            <button className="btn sm icon" aria-label="Previous slide" onClick={() => setI((v) => Math.max(0, v - 1))}><ChevronLeft /></button>
            <button className="btn sm" onClick={() => setI((v) => Math.min(n - 1, v + 1))}>Next <ChevronRight /></button>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
