import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle, Beaker, BookMarked, Calculator, Check, CheckCircle2, Clock, CloudSun, HelpCircle, Info, Layers, Loader2, Monitor, Moon, Satellite, Sun, User, X, XCircle,
} from 'lucide-react';
import type { Reason, SourceTag } from '../../domain/types';
import type { Affordability } from '../../engine/budget';
import { sourceById } from '../../data/sources';
import { fmtMoney } from '../../domain/units';

/* ---------- source chips (provenance): one neutral style, NASA alone in accent ---------- */
const TAG_LABEL: Record<SourceTag, string> = {
  farmer: 'Farmer reported', nasa: 'NASA data', soilgrids: 'SoilGrids (ISRIC)', forecast: 'Forecast (Open-Meteo)', rule: 'Local rule', modeled: 'Modeled', synthetic: 'Synthetic demo',
};
const TAG_ICON: Record<SourceTag, ReactNode> = { farmer: <User />, nasa: <Satellite />, soilgrids: <Layers />, forecast: <CloudSun />, rule: <BookMarked />, modeled: <Calculator />, synthetic: <Beaker /> };

export function Tag({ t, children }: { t: SourceTag; children?: ReactNode }) {
  return <span className={`chip ${t === 'nasa' ? 'nasa' : ''}`} title={TAG_LABEL[t]}>{TAG_ICON[t]}{children ?? TAG_LABEL[t]}</span>;
}

export function Ref({ id }: { id: string }) {
  if (id.startsWith('input:')) return <span className="chip" title="Comes from your inputs">input · {id.slice(6)}</span>;
  if (id.startsWith('price')) return <span className="chip" title="Price pack entry">price</span>;
  const s = sourceById(id);
  if (s) return <a className="chip" href={s.url} target="_blank" rel="noopener noreferrer" title={`${s.title}\nLimits: ${s.limits}`}>{id}</a>;
  return <span className="chip" title="Rule pack entry; see Methods">{id}</span>;
}

/* ---------- reasons ---------- */
const ICON = { block: <X />, warn: <AlertTriangle />, good: <Check />, info: <Info /> } as const;
export function ReasonList({ reasons, max, refs = true }: { reasons: Reason[]; max?: number; refs?: boolean }) {
  const list = max ? reasons.slice(0, max) : reasons;
  return (
    <div>
      {list.map((r, i) => (
        <div key={i} className={`reason ${r.severity}`}>
          <span className="ico" aria-hidden>{ICON[r.severity]}</span>
          <span>
            {r.text}
            {refs && r.refs.length > 0 && <span className="refs">{r.refs.slice(0, 3).map((x) => <Ref key={x} id={x} />)}</span>}
          </span>
        </div>
      ))}
      {max && reasons.length > max && <div className="mini">+{reasons.length - max} more</div>}
    </div>
  );
}

/* ---------- stats ---------- */
/** Splits "327,000 XOF" into the number and its currency code. */
export function splitMoney(x: number | null | undefined, cur: string): [string, string] {
  const s = fmtMoney(x, cur);
  return s.endsWith(` ${cur}`) ? [s.slice(0, -cur.length - 1), cur] : [s, ''];
}
export function Money({ v, cur }: { v: number | null | undefined; cur: string }) {
  const [n, c] = splitMoney(v, cur);
  return <>{n}{c && <span className="unit">{c}</span>}</>;
}

/** The one hero number per card: caption, number, one muted sub-line. */
export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="stat">
      <span className="caption">{label}</span>
      <span className={`hero-num ${tone ?? ''}`}>{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

/** Secondary stat rows: label left, value right, dashed rules. */
export function StatRows({ rows }: { rows: ([ReactNode, ReactNode] | [ReactNode, ReactNode, 'wrap'] | null | false)[] }) {
  return (
    <dl className="dl">
      {rows.filter(Boolean).map((r, i) => { const [k, v, w] = r as [ReactNode, ReactNode, string?]; return <div key={i}><dt>{k}</dt><dd className={w === 'wrap' ? 'wrap' : ''}>{v}</dd></div>; })}
    </dl>
  );
}

/** KPI value for a strip (h2 size). Tone only for budget verdicts. */
export function Kpi({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' | 'warn'; icon?: ReactNode }) {
  const cls = tone === 'ok' ? 'good-t' : tone === 'bad' ? 'bad-t' : tone === 'warn' ? 'warn-t' : '';
  return (
    <div className="stat">
      <span className="caption">{label}</span>
      <span className={`kpi-v ${cls}`}>{value}</span>
      {sub && <span className="mini">{sub}</span>}
    </div>
  );
}

/** A top-of-page KPI strip: one card, columns divided by dashed rules. */
export function KpiStrip({ children }: { children: ReactNode }) {
  return <div className="card"><div className="cols kpi-strip">{children}</div></div>;
}

/* ---------- status badges (budget verdicts only) ---------- */
export const STATUS: Record<Affordability, { cls: 'good' | 'bad' | 'warn'; t: string; i: ReactNode }> = {
  affordable: { cls: 'good', t: 'Fits budget', i: <CheckCircle2 /> },
  unaffordable: { cls: 'bad', t: 'Over budget', i: <XCircle /> },
  unverified: { cls: 'warn', t: 'Budget not verified', i: <HelpCircle /> },
  timing: { cls: 'bad', t: 'Cash-timing gap', i: <Clock /> },
};
export function StatusBadge({ status }: { status: Affordability }) {
  const s = STATUS[status];
  return <span className={`badge ${s.cls}`}>{s.i}{s.t}</span>;
}

/** Budget bar: fill = cost share of budget, tick = the budget. */
export function BudgetBar({ cost, cap, status }: { cost: number; cap: number; status: Affordability }) {
  const max = Math.max(cost, cap, 1);
  const fill = Math.max(0, Math.min(1, cost / max));
  const tick = Math.max(0, Math.min(1, cap / max));
  const cls = status === 'affordable' ? '' : status === 'unverified' ? 'warn' : 'bad';
  return (
    <div className="bbar" role="meter" aria-label="Cash cost against budget" aria-valuenow={Math.round(cost)} aria-valuemin={0} aria-valuemax={Math.round(cap)}>
      <i className={cls} style={{ width: `${fill * 100}%` }} />
      <b style={{ left: `calc(${tick * 100}% - 1px)` }} />
    </div>
  );
}

export function Meter({ value }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return <div className="meter" role="meter" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${v * 100}%` }} /></div>;
}

/* ---------- callouts & disclaimer ---------- */
/** Blocking states only (warn / bad). Informational tones render as a quiet note line. */
export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok' | 'bad'; children: ReactNode }) {
  if (tone === 'info' || tone === 'ok') return <div className="note"><div className="line"><Info aria-hidden /><div>{children}</div></div></div>;
  const icon = tone === 'warn' ? <AlertTriangle aria-hidden /> : <XCircle aria-hidden />;
  return <div className={`callout ${tone}`} role={tone === 'bad' ? 'alert' : undefined}>{icon}<div>{children}</div></div>;
}

/** One quiet line with an info icon and a "Details" toggle that expands a list below. */
export function Disclaimer({ children, details, label = 'Details' }: { children: ReactNode; details?: ReactNode[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="note">
      <div className="line">
        <Info aria-hidden />
        <div>{children}{details && details.length > 0 && <> <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide details' : label}</button></>}</div>
      </div>
      {open && details && <ul>{details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
    </div>
  );
}

/* ---------- form controls ---------- */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field">{label}{children}{hint && <span className="hint">{hint}</span>}</label>;
}

export function NumInput({ value, onChange, step, min, placeholder, className, allowNull, label }: { value: number | null | undefined; onChange: (v: number | null) => void; step?: number; min?: number; placeholder?: string; className?: string; allowNull?: boolean; label?: string }) {
  return (
    <input
      className={`input ${className ?? ''}`} type="number" inputMode="decimal" step={step ?? 'any'} min={min} aria-label={label}
      value={value == null || !Number.isFinite(value) ? '' : value} placeholder={placeholder ?? (allowNull ? 'unknown' : '')}
      onChange={(e) => { const t = e.target.value; if (t === '') onChange(allowNull ? null : 0); else onChange(Number(t)); }}
    />
  );
}

/** Tabs and segmented controls are one component. Scrolls inside itself with a right-edge fade when it overflows. */
export function Seg<T extends string>({ value, options, onChange, label, role = 'radiogroup' }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; label?: string; role?: 'radiogroup' | 'tablist' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
    f();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(f) : null;
    ro?.observe(el); el.addEventListener('scroll', f, { passive: true });
    return () => { ro?.disconnect(); el.removeEventListener('scroll', f); };
  }, [options.length]);
  const itemRole = role === 'tablist' ? 'tab' : 'radio';
  return (
    <div ref={ref} className={`seg-wrap ${fade ? 'fade' : ''}`}>
      <div className="seg" role={role} aria-label={label}>
        {options.map((o) => (
          <button key={o.v} type="button" role={itemRole} aria-checked={itemRole === 'radio' ? value === o.v : undefined} aria-selected={itemRole === 'tab' ? value === o.v : undefined} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

/** Card title: h3 with an optional 16 px muted icon inline. */
export function CardTitle({ icon, children }: { icon?: ReactNode; tone?: string; children: ReactNode }) {
  return <h3 className="card-title">{icon}{children}</h3>;
}

/* ---------- empty & loading ---------- */
export function Empty({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <div className="empty">{icon}<p>{children}</p>{action}</div>;
}

export function Loading({ text }: { text: string }) {
  return (
    <div role="status">
      <div className="loading-line"><Loader2 className="spin" aria-hidden />{text}</div>
      <div className="skel" style={{ height: 180 }} />
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="card plan" aria-hidden>
      <div className="skel" style={{ width: '60%', height: 16 }} />
      <div className="skel" style={{ width: '40%', height: 36 }} />
      <div className="stack-sm">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 12 }} />)}</div>
    </div>
  );
}

/** Shown while 25 years of daily NASA POWER data download for a new location. */
export function NasaLoading({ place, variant = 'plans' }: { place?: string; variant?: 'plans' | 'block' }) {
  return (
    <div role="status" className="loading-banner">
      <div className="loading-line"><Loader2 className="spin" aria-hidden />Reading 25 years of NASA POWER{place ? ` for ${place.split(',')[0]}` : ''}…</div>
      {variant === 'plans' ? <div className="plan-row"><PlanSkeleton /><PlanSkeleton /><PlanSkeleton /></div> : <div className="skel" style={{ height: 160 }} />}
    </div>
  );
}

export const pct = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);
export const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- theme (System → Light → Dark) ---------- */
export type ThemeMode = 'system' | 'light' | 'dark';
const THEME_KEY = 'fieldshift.theme';
function readMode(): ThemeMode {
  try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { /* storage unavailable: stay on system */ return 'system'; }
}
function applyMode(m: ThemeMode) {
  if (m === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = m;
  try { if (m === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, m); } catch { /* storage unavailable: stay on system */ }
}
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(readMode);
  useEffect(() => { applyMode(mode); }, [mode]);
  const next: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
  const icon = mode === 'system' ? <Monitor /> : mode === 'light' ? <Sun /> : <Moon />;
  return <button type="button" className={`btn ghost plain icon ${className}`} aria-label={`Theme: ${mode}`} title={`Theme: ${mode} (click for ${next[mode]})`} onClick={() => setMode(next[mode])}>{icon}</button>;
}
