import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, BookMarked, Calculator, Check, ChevronLeft, ChevronRight, CloudRain, Droplets, FileDown,
  NotebookPen, Plus, Satellite, Shovel, Sprout, Users, Wallet, X, Sun, Moon,
  Languages, Bot, Mic, LayoutDashboard, Cpu, Rocket, Workflow, Target, Code,
} from 'lucide-react';
import type { Route } from '../../App';
import { useApp } from '../../state/AppContext';
import { seasonEndOf } from './season';
import { yearlyWindow } from '../../weather/indicators';
import { BrandMark } from '../components/Logo';
import { OrbitVisual } from '../components/OrbitVisual';
import { SeasonRainChart, useChartTheme } from '../components/charts';
import { BEST_FIT, PlanRows, ScoreTable, scoreAll } from './Compare';
import { PrioritySliders } from '../components/PrioritySliders';
import { TEAM_NAME, TEAM_PROFILES } from '../../data/team';
import type { EngineOutput, PlanResult } from '../../engine/plan';
import type { PriorityWeights } from '../../domain/types';

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
      <div className="foot"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BrandMark size={18} /> Field Shift · NASA Space Apps 2026</span><span>{n} / {total}</span></div>
    </div>
  );
}

/** Source footnote at the bottom of a data slide. */
const Source = ({ children }: { children: ReactNode }) => <div className="muted" style={{ fontSize: 11.5, marginTop: 'auto', paddingTop: 8, paddingBottom: 18 }}>* Sources: {children}</div>;

/** Highlighted phrase in a slide title (brand ink; no gradient text). */
const G = ({ children }: { children: ReactNode }) => <span className="hl">{children}</span>;

/** A grouped block on a slide: surface-2 fill, no border (never a card in a card). */
function Panel({ children, d = 0, style }: { children: ReactNode; d?: number; style?: React.CSSProperties }) {
  return <motion.div className="boxed" {...up(d)} style={style}>{children}</motion.div>;
}

// ---------- visuals ----------
/** Slide 3: the live Compare page in miniature: the vertical plan list and the best fit's score breakdown. */
function MiniCompare({ engine, cur, weights }: { engine: EngineOutput; cur: string; weights: PriorityWeights }) {
  const plans = [engine.baseline, ...engine.alternatives];
  const scores = scoreAll(engine, weights);
  const best = engine.alternatives[0] ? scores.get(engine.alternatives[0].id) : undefined;
  const labelOf = (p: PlanResult, k: number) => (p.isBaseline ? 'Your usual plan' : k === 1 ? BEST_FIT : p.label || 'Option B');
  return (
    <motion.div {...quick(0)} className="mini-compare2">
      <div className="mc2-sliders boxed"><span className="caption hl">What matters to you · drag to re-rank live</span><PrioritySliders compact /></div>
      <PlanRows plans={plans} labelOf={labelOf} scores={scores} cur={cur}>
        <div className="pl-add"><span className="btn sm" aria-hidden><Plus size={14} /> Add your own plan</span><span className="muted" style={{ fontSize: 13 }}>scored on the same scale as the plans above</span></div>
      </PlanRows>
      {best && (
        <motion.div {...quick(0.2)} className="mc2-score boxed">
          <div className="caption hl">{BEST_FIT} · score breakdown</div>
          <ScoreTable score={best} />
        </motion.div>
      )}
    </motion.div>
  );
}

/** Slide 4: a simple schema of the product, inputs → engine → outputs. */
function ProductSchema() {
  const t = useChartTheme();
  const inputs: [ReactNode, string, string, boolean][] = [
    [<CloudRain size={18} />, 'NASA POWER', 'daily weather since 2001', true],
    [<Satellite size={18} />, 'NASA satellites', 'SMAP · MODIS · GRACE context', true],
    [<Shovel size={18} />, 'SoilGrids', 'soil → water the root zone holds', false],
    [<Wallet size={18} />, 'FAOSTAT prices', 'local currency, 240 countries', false],
    [<NotebookPen size={18} />, 'The farmer', 'past crops, budget, constraints', false],
  ];
  const outputs: [ReactNode, string, string][] = [
    [<Check size={18} />, 'Plans you can afford', 'usual plan + up to 2 alternatives'],
    [<Droplets size={18} />, 'Risk in bad years', '24 season pairs + drier & hotter'],
    [<BookMarked size={18} />, 'Reasons & sources', 'for every number'],
    [<FileDown size={18} />, 'Printable plan', 'and a share link'],
  ];
  const box = (ic: ReactNode, title: string, sub: string, k: number, nasa = false) => (
    <motion.div key={title} {...up(0.15 + k * 0.05)} className="boxed" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', minHeight: 0 }}>
      <span className={nasa ? 'hl' : 'muted'}>{ic}</span>
      <div style={{ minWidth: 0 }}><b className="ink" style={{ fontSize: 15 }}>{title}</b>{nasa && <span className="chip nasa" style={{ marginLeft: 6 }}>NASA</span>}<div className="muted" style={{ fontSize: 12.5, lineHeight: 1.3 }}>{sub}</div></div>
    </motion.div>
  );
  const fan = (n: number, dir: 'in' | 'out') => (
    <svg viewBox="0 0 40 100" preserveAspectRatio="none" width="100%" height="100%" aria-hidden>
      {Array.from({ length: n }, (_, k) => {
        const y = ((2 * k + 1) / (2 * n)) * 100;
        const d = dir === 'in' ? `M0 ${y} C20 ${y}, 20 50, 40 50` : `M0 50 C20 50, 20 ${y}, 40 ${y}`;
        return <motion.path key={k} d={d} fill="none" stroke={t.brand} strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: (dir === 'in' ? 0.3 : 0.8) + k * 0.05, duration: 0.4 }} />;
      })}
    </svg>
  );
  const step = (n: number, text: string) => <div key={n} className="row" style={{ gap: 8, fontSize: 14, alignItems: 'baseline' }}><span className="mc-n" style={{ flex: 'none' }}>{n}</span><span className="muted">{text}</span></div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1.25fr 48px 1fr', alignItems: 'stretch', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div className="caption">Data in</div>{inputs.map(([ic, h, d, nasa], k) => box(ic, h, d, k, nasa))}</div>
      <div style={{ paddingTop: 26 }}>{fan(inputs.length, 'in')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="caption">Field Shift engine · runs in the browser</div>
        <motion.div {...up(0.5)} className="boxed" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, border: `2px solid ${t.brand}` }}>
          <b className="ink row" style={{ gap: 6 }}><Droplets size={16} /> Weather &amp; soil</b>
          {step(1, 'Sowing date for every past year (rain onset)')}
          {step(2, 'Daily soil-water balance (FAO-56)')}
        </motion.div>
        <div style={{ textAlign: 'center', lineHeight: 0 }}><ArrowRight size={18} className="hl" style={{ transform: 'rotate(90deg)' }} /></div>
        <motion.div {...up(0.6)} className="boxed" style={{ flex: 1.4, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, border: `2px solid ${t.brand}` }}>
          <b className="ink row" style={{ gap: 6 }}><Calculator size={16} /> Plan calculator</b>
          {step(3, 'Yield in 24 real season pairs (FAO-66)')}
          {step(4, 'Cash check at every due date')}
          {step(5, 'Rotation rules, then rank, with reasons')}
        </motion.div>
      </div>
      <div style={{ paddingTop: 26 }}>{fan(outputs.length, 'out')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div className="caption">What the farmer gets</div>{outputs.map(([ic, h, d], k) => box(ic, h, d, k + 6))}</div>
    </div>
  );
}

/** Slide 5: what each similar tool has, from its public pages (Nov 2026). y = yes, p = partly, n = no. */
const RIVALS = ['Field Shift', 'E-PICSA', 'Precision Dev.', 'FarmerChat', 'Crop Planner (UK)', 'OneSoil'];
const FEATURES: [string, string][] = [
  ['Checks the plan against your cash and due dates', 'ypnnpn'],
  ['Computes each plan’s risk from past weather', 'ypnnnn'],
  ['Compares crop rotations side by side', 'ypnnyp'],
  ['Works anywhere on Earth', 'ynnpnp'],
  ['Built for smallholders and extension workers', 'yyyynp'],
];
function CheckTable() {
  const cell = (v: string) => v === 'y' ? <Check size={22} className="good-t" aria-label="yes" /> : v === 'p' ? <span className="muted" style={{ fontSize: 13 }}>partly</span> : <X size={20} className="muted" aria-label="no" style={{ opacity: 0.6 }} />;
  return (
    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 15 }}>
      <thead><tr><th style={{ textAlign: 'left', padding: '8px 12px' }} />{RIVALS.map((r, k) => <th key={r} className={k === 0 ? 'boxed' : ''} style={{ padding: '10px 8px', textAlign: 'center', fontSize: k === 0 ? 16 : 13, borderRadius: k === 0 ? '12px 12px 0 0' : 0 }}><span className={k === 0 ? 'hl' : 'muted'}>{r}</span></th>)}</tr></thead>
      <tbody>{FEATURES.map(([f, v], i) => (
        <motion.tr key={f} {...up(0.2 + i * 0.06)}>
          <td style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }} className="ink">{f}</td>
          {v.split('').map((c, k) => <td key={k} className={k === 0 ? 'boxed' : ''} style={{ textAlign: 'center', padding: '10px 8px', borderTop: '1px solid var(--border)', borderRadius: k === 0 && i === FEATURES.length - 1 ? '0 0 12px 12px' : 0 }}>{cell(c)}</td>)}
        </motion.tr>
      ))}</tbody>
    </table>
  );
}

// ---------- deck ----------
export function PitchPage({ go }: { go: (r: Route) => void }) {
  const { engine, data, scenario } = useApp();
  const cut = 'pitch';
  // The deck opens in light mode; the button switches it for this deck only, and the app's own theme comes back on exit.
  const [deckTheme, setDeckTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const root = document.documentElement, prev = root.dataset.theme;
    return () => { if (prev) root.dataset.theme = prev; else delete root.dataset.theme; };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = deckTheme; }, [deckTheme]);
  const [i, setI] = useState(0);
  const [printing, setPrinting] = useState(false);
  const rows = useMemo(() => (data.series && engine ? yearlyWindow(data.series, engine.window.earliest, seasonEndOf(engine)) : []), [data.series, engine]);
  const mn = rows.length ? Math.min(...rows.map((r) => r.windowRain)) : 0, mx = rows.length ? Math.max(...rows.map((r) => r.windowRain)) : 0;
  const minRow = rows.find((r) => r.windowRain === mn), maxRow = rows.find((r) => r.windowRain === mx);
  const cur = scenario.currency;
  const place = (scenario.location.label ?? '').split(',')[0] || 'this site';
  const plans = engine ? [engine.baseline, ...engine.alternatives] : [];
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
    { id: 'problem', kicker: '01 / The problem', icon: <CloudRain size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Every season, farmers bet their savings on the sky, before they know the rain.</motion.h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 32, flex: 1, alignItems: 'center' }}>
          <motion.div {...up(0.2)}>
            <div className="hl" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>The rain gamble</div>
            <h3 style={{ fontSize: 'clamp(20px, 2.2vw, 30px)', lineHeight: 1.2, margin: '8px 0 16px' }}>The wettest year brought <span className="hl">{(mx / Math.max(1, mn)).toFixed(1)}×</span> the rain of the driest, on the same field.</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', alignItems: 'baseline' }}>
              <b className="ink" style={{ fontSize: 26 }}>$170 B</b><span className="muted" style={{ fontSize: 14 }}>yearly smallholder finance gap; 70% of need unmet</span>
              <b className="ink" style={{ fontSize: 26 }}>1 : 1,000+</b><span className="muted" style={{ fontSize: 14 }}>extension agents to farmers in many countries</span>
              <b className="ink" style={{ fontSize: 26 }}>608 M</b><span className="muted" style={{ fontSize: 14 }}>farms worldwide, 84% under 2 ha: the market</span>
            </div>
          </motion.div>
          <motion.div {...fade(0.3)}>
            <b className="ink" style={{ fontSize: 16 }}>Season rain at {place}, every year since 2001 (mm)</b>
            {minRow && maxRow && <div className="muted" style={{ fontSize: 13 }}>Highlighted: driest {minRow.year} ({Math.round(mn)} mm) and wettest {maxRow.year} ({Math.round(mx)} mm)</div>}
            {rows.length > 0 && minRow && maxRow && <SeasonRainChart rows={rows} highlight={[minRow.year, maxRow.year]} height={200} />}
          </motion.div>
        </div>
        <motion.div {...up(0.5)} style={{ marginTop: 8 }}>
          <b style={{ fontSize: 15 }}>Why it happens</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 6 }}>
            {[['Rain decides', 'Rain-fed farms give 52% of world crop output (FAO 2025).'], ['Cash comes before rain', 'Inputs are paid before sowing; credit and insurance rarely reach smallholders.'], ['Advice is scarce', 'Generic tips, no check of what a plan costs or how it fails in a bad year.'], ['Markets push one crop', 'Wheat ≈ 56% of Kazakhstan’s sown area (2024 plan).']].map(([h, d]) => (
              <div key={h} style={{ fontSize: 13, lineHeight: 1.35 }}><b className="ink">{h}</b><div className="muted">{d}</div></div>
            ))}
          </div>
        </motion.div>
        <Source>NASA POWER (grid cell, not a field station); ISF Advisors 2019; Fabregas, Kremer &amp; Schilbach, Science 2019; FAO.</Source>
      </>
    ) },
    { id: 'solution', kicker: '02 / Our solution', icon: <Sprout size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)} style={{ marginBottom: 8, fontSize: 'clamp(20px, 2.3vw, 30px)' }}>Which next plans can I <G>afford</G>, and how do they hold up in a <G>bad year</G>?</motion.h2>
        <motion.div {...up(0.15)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {['Your field', 'Budget & crops', 'Compare plans', 'Review evidence'].map((s, k, a) => (
            <span key={s} style={{ display: 'contents' }}>
              <span className="boxed" style={{ padding: '6px 12px', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}><span className="hl">{k + 1}</span> {s}</span>
              {k < a.length - 1 && <ArrowRight size={16} className="muted" aria-hidden />}
            </span>
          ))}
        </motion.div>
        <motion.div {...up(0.2)} className="ink" style={{ fontSize: 15, fontWeight: 600 }}>Live for {place}: move a slider and every score, rank and breakdown updates</motion.div>
        {engine && plans.length > 0 ? <MiniCompare engine={engine} cur={cur} weights={scenario.weights} /> : null}
      </>
    ) },
    { id: 'how', kicker: '03 / How it works', icon: <Cpu size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)} style={{ marginBottom: 12 }}>Published science in a free web app: no black box.</motion.h2>
        <ProductSchema />
        <motion.div {...up(0.9)} style={{ margin: '12px 0 20px', fontSize: 13, display: 'grid', gap: 4 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><b className="row ink" style={{ gap: 6 }}><Code size={15} /> Stack:</b><span className="muted">React + TypeScript + Vite · static site, GitHub Pages CI · no backend, works offline · 227 automated tests</span></div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><b className="row ink" style={{ gap: 6 }}><Workflow size={15} /> Process:</b><span className="muted">Brief &amp; research → spec + evidence register → engine first, tested on archived NASA data &amp; the FAO-56 example → UI + 16 regional packs → hindcast vs real FAOSTAT yields</span></div>
        </motion.div>
      </>
    ) },
    { id: 'edge', kicker: '04 / Why it is better', icon: <Target size={14} />, body: (
      <>
        <motion.h2 {...up(0.1)}>Others show what grows. Field Shift shows what you can <G>afford</G>.</motion.h2>
        <motion.div {...fade(0.15)} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <CheckTable />
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Only Field Shift has all five. Plus: every number traced to a source, no AI in the decision, checked against real harvests. “Partly”: E-PICSA builds budgets without due dates and shows rainfall graphs for people to read; Crop Planner gives gross margins for the UK only; OneSoil keeps a rotation record.</p>
        </motion.div>
        <Source>each tool’s public pages, checked Nov 2026 (E-PICSA: GIZ 2023; PxD 2024 annual report; Digital Green; ADAS Crop Planner, Apr 2026; OneSoil help centre).</Source>
      </>
    ) },
    { id: 'next', kicker: '05 / What comes next', icon: <Rocket size={14} />, body: (
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
    { id: 'team', kicker: `06 / Why us · Team ${TEAM_NAME}`, icon: <Users size={14} />, body: (
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
  ];
  // Exactly seven slides, in the order the team asked for.
  const PITCH = ['title', 'problem', 'solution', 'how', 'edge', 'next', 'team'];
  const slides = PITCH.map((id) => all.find((s) => s.id === id)!);
  const n = slides.length;
  const idx = Math.min(i, n - 1);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      // a slider or field on a slide keeps its own keys (arrows move the slider, not the deck)
      const el = e.target as HTMLElement | null;
      if (el && el.closest('input, select, textarea, [contenteditable="true"]') && e.key !== 'Escape') return;
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
            <button className="btn sm icon" aria-label={deckTheme === 'light' ? 'Switch slides to dark' : 'Switch slides to light'} title={deckTheme === 'light' ? 'Dark slides' : 'Light slides'} onClick={() => setDeckTheme((m) => (m === 'light' ? 'dark' : 'light'))}>{deckTheme === 'light' ? <Moon /> : <Sun />}</button>
            <button className="btn sm" onClick={() => setPrinting(true)} title="Print every slide, one per page (save as PDF)"><FileDown /> PDF</button>
            <button className="btn sm icon" aria-label="Previous slide" onClick={() => setI((v) => Math.max(0, v - 1))}><ChevronLeft /></button>
            <button className="btn sm" onClick={() => setI((v) => Math.min(n - 1, v + 1))}>Next <ChevronRight /></button>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
