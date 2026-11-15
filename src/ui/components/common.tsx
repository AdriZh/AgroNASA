import type { ReactNode } from 'react';
import { Satellite as SatelliteIcon, AlertTriangle, Beaker, Calculator, Check, CheckCircle2, CloudSun, Info, Layers, BookMarked, Satellite, User, X, XCircle } from 'lucide-react';
import type { Reason, SourceTag } from '../../domain/types';
import { sourceById } from '../../data/sources';

const TAG_LABEL: Record<SourceTag, string> = {
  farmer: 'Farmer reported', nasa: 'NASA data', soilgrids: 'SoilGrids (ISRIC)', forecast: 'Forecast (Open-Meteo)', rule: 'Local rule', modeled: 'Modeled', synthetic: 'Synthetic demo',
};
const TAG_ICON: Record<SourceTag, ReactNode> = { farmer: <User />, nasa: <Satellite />, soilgrids: <Layers />, forecast: <CloudSun />, rule: <BookMarked />, modeled: <Calculator />, synthetic: <Beaker /> };

export function Tag({ t, children }: { t: SourceTag; children?: ReactNode }) {
  return <span className={`chip ${t}`} title={TAG_LABEL[t]}>{TAG_ICON[t]} {children ?? TAG_LABEL[t]}</span>;
}

export function Ref({ id }: { id: string }) {
  if (id.startsWith('input:')) return <span className="chip ref" title="Comes from your inputs">input · {id.slice(6)}</span>;
  if (id.startsWith('price')) return <span className="chip ref" title="Price pack entry">price</span>;
  const s = sourceById(id);
  if (s) return <a className="chip ref" href={s.url} target="_blank" rel="noreferrer" title={`${s.title}\nLimits: ${s.limits}`}>{id}</a>;
  return <span className="chip ref" title="Rule pack entry — see Methods">{id}</span>;
}

const ICON = { block: <X />, warn: <AlertTriangle />, good: <Check />, info: <Info /> } as const;
export function ReasonList({ reasons, max }: { reasons: Reason[]; max?: number }) {
  const list = max ? reasons.slice(0, max) : reasons;
  return (
    <div>
      {list.map((r, i) => (
        <div key={i} className={`reason ${r.severity}`}>
          <span className="ico" aria-hidden>{ICON[r.severity]}</span>
          <span>
            {r.text}
            <span className="refs">{r.refs.slice(0, 3).map((x) => <Ref key={x} id={x} />)}</span>
          </span>
        </div>
      ))}
      {max && reasons.length > max && <div className="mini">+{reasons.length - max} more</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' | 'warn'; icon?: ReactNode }) {
  const color = tone === 'ok' ? 'var(--brand)' : tone === 'bad' ? 'var(--red)' : tone === 'warn' ? 'var(--amber)' : undefined;
  return (
    <div className="kpi">
      <span className="l" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</span>
      <span className="v" style={{ color }}>{value}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok' | 'bad'; children: ReactNode }) {
  const icon = { info: <Info />, warn: <AlertTriangle />, ok: <CheckCircle2 />, bad: <XCircle /> }[tone];
  return <div className={`callout ${tone}`}>{icon}<div>{children}</div></div>;
}

export function Meter({ value, color }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const c = color ?? (v < 0.15 ? 'linear-gradient(90deg,#34d399,#10b981)' : v < 0.35 ? 'linear-gradient(90deg,#fcd34d,#f59e0b)' : 'linear-gradient(90deg,#f87171,#dc2626)');
  return <div className="meter" role="meter" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${v * 100}%`, background: c }} /></div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field">{label}{children}{hint && <span className="hint">{hint}</span>}</label>;
}

export function NumInput({ value, onChange, step, min, placeholder, className, allowNull }: { value: number | null | undefined; onChange: (v: number | null) => void; step?: number; min?: number; placeholder?: string; className?: string; allowNull?: boolean }) {
  return (
    <input
      className={`input ${className ?? ''}`} type="number" inputMode="decimal" step={step ?? 'any'} min={min}
      value={value == null || !Number.isFinite(value) ? '' : value} placeholder={placeholder ?? (allowNull ? 'unknown' : '')}
      onChange={(e) => { const t = e.target.value; if (t === '') onChange(allowNull ? null : 0); else onChange(Number(t)); }}
    />
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return <div className="seg" role="radiogroup">{options.map((o) => <button key={o.v} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>)}</div>;
}

export function CardTitle({ icon, tone, children }: { icon: ReactNode; tone?: 'sky' | 'violet' | 'amber' | 'soil' | 'red' | 'teal' | 'dark'; children: ReactNode }) {
  return <h3><span className={`ic ${tone ?? ''}`}>{icon}</span>{children}</h3>;
}

export function Loading({ text }: { text: string }) {
  return <div className="empty"><span className="spinner" /> &nbsp;{text}</div>;
}

export const pct = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Shown while 25 years of daily NASA POWER data download for a new location. */
export function NasaLoading({ place }: { place?: string }) {
  return (
    <div className="loading-banner" role="status">
      <span className="ic sky" style={{ width: 44, height: 44, flexBasis: 44, borderRadius: 14 }}><SatelliteIcon size={22} /></span>
      <div style={{ flex: 1 }}>
        <b>Downloading 25 years of daily NASA POWER data{place ? ` for ${place}` : ''}…</b>
        <div className="mini">Rain, temperature, humidity, wind, solar radiation and soil wetness since 2001 (~1.3 MB). First time 10–40 s, then cached on this device. Soil data loads in parallel.</div>
        <div className="bar"><i /></div>
      </div>
    </div>
  );
}
