import type { ReactNode } from 'react';
import type { Reason, SourceTag } from '../../domain/types';
import { sourceById } from '../../data/sources';

const TAG_LABEL: Record<SourceTag, string> = {
  farmer: 'Farmer reported', nasa: 'NASA data', soilgrids: 'SoilGrids (ISRIC)', forecast: 'Forecast (Open-Meteo)', rule: 'Local rule', modeled: 'Modeled', synthetic: 'Synthetic demo',
};
const TAG_ICON: Record<SourceTag, string> = { farmer: '👩🏾‍🌾', nasa: '🛰️', soilgrids: '🟤', forecast: '⛅', rule: '📘', modeled: '🧮', synthetic: '🧪' };

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

const ICON = { block: '✕', warn: '!', good: '✓', info: 'i' } as const;
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

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' | 'warn' }) {
  const color = tone === 'ok' ? 'var(--brand)' : tone === 'bad' ? 'var(--red)' : tone === 'warn' ? 'var(--amber)' : undefined;
  return (
    <div className="kpi">
      <span className="l">{label}</span>
      <span className="v" style={{ color }}>{value}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok' | 'bad'; children: ReactNode }) {
  const icon = { info: 'ℹ️', warn: '⚠️', ok: '✅', bad: '⛔' }[tone];
  return <div className={`callout ${tone}`}><span aria-hidden>{icon}</span><div>{children}</div></div>;
}

export function Meter({ value, color }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const c = color ?? (v < 0.15 ? 'var(--brand-2)' : v < 0.35 ? '#e0a100' : 'var(--red)');
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

export function Loading({ text }: { text: string }) {
  return <div className="empty"><span className="spinner" /> &nbsp;{text}</div>;
}

export const pct = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);
export const uid = () => Math.random().toString(36).slice(2, 9);
