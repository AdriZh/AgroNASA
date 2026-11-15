// "Field free for a short window?": which crop (or rest) fits a gap between two dates, replayed on the
// NASA POWER record with growing-degree days, autumn frost and the FAO-56 water balance (engine/window.ts).
import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Play } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { defaultWindow, fitWindow, fmtMMDD, skippedSeason, type WindowFit, type WindowResult, type WindowSpec } from '../../engine/window';
import { completeYears } from '../../weather/indicators';
import { cropEmoji, cropName } from '../../data/crops';
import { fxPerUsd } from '../../data/countries';
import { fmtApprox } from '../../domain/units';
import { CardTitle, Tag } from './common';

const MM = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const LAST = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const START_OPTS = MM.flatMap((m) => [`${m}-01`, `${m}-15`]);
const END_OPTS = MM.flatMap((m, i) => [`${m}-15`, `${m}-${LAST[i]}`]);
const same = (a: WindowSpec, b: WindowSpec) => a.start === b.start && a.end === b.end;

const TAG: Record<WindowFit['tag'], { cls: string; t: string }> = {
  cash: { cls: 'cash', t: 'Cash crop' },
  cover: { cls: 'cover', t: 'Soil benefit, little or no cash' },
  rest: { cls: 'rest', t: 'Rest' },
};

function Option({ f, rec, cur }: { f: WindowFit; rec: boolean; cur: string }) {
  const tag = TAG[f.tag];
  const n = Math.max(1, f.seasons);
  const fx = fxPerUsd(cur);
  const seed = f.seedUsdPerHa == null ? null : fx ? fmtApprox(f.seedUsdPerHa * fx, cur) : fmtApprox(f.seedUsdPerHa, 'USD');
  return (
    <li className={`fw-opt ${rec ? 'rec' : ''}`}>
      <span className="fw-icon" aria-hidden>{cropEmoji(f.cropId)}</span>
      <div className="fw-name">
        <b>{f.tag === 'rest' ? 'Rest the field (fallow)' : cropName(f.cropId)}</b>
        <span className={`fw-tag ${tag.cls}`}>{tag.t}</span>
        {rec && <span className="badge good">Recommended</span>}
      </div>
      {f.tag === 'rest'
        ? <div className="fw-key">The safe option in every season</div>
        : (
          <div className="fw-key">
            <span>Matured in time in <b className="fw-num">{f.matured} of {f.seasons}</b> past seasons</span>
            <span className="fw-meter" role="img" aria-label={`${f.reliable} of ${f.seasons} without severe water stress, ${f.severeStress} with severe water stress`}>
              <i className="ok" style={{ width: `${(f.reliable / n) * 100}%` }} />
              <i className="warn" style={{ width: `${(f.severeStress / n) * 100}%` }} />
            </span>
          </div>
        )}
      <p className="fw-reason">
        {f.reason}
        {f.tag !== 'rest' && f.medianMaturity && f.binding && f.matured > 0 && <> Median maturity ≈ {fmtMMDD(f.medianMaturity)}.</>}
        {seed && <> Seed {seed}/ha; nothing to sell.</>}
      </p>
    </li>
  );
}

export function FieldWindowPanel() {
  const { engine, data, soil, scenario } = useApp();
  const pack = engine?.pack;
  const lat = scenario.location.lat;
  const def = useMemo(() => (pack ? defaultWindow(pack, lat) : null), [pack, lat]);
  const [draft, setDraft] = useState<WindowSpec | null>(def);
  const [checked, setChecked] = useState<WindowSpec | null>(def);
  // a new location or pack starts again from its own typical gap
  useEffect(() => { setDraft(def); setChecked(def); }, [def?.start, def?.end, pack?.id, data.series]); // eslint-disable-line react-hooks/exhaustive-deps

  const result: WindowResult | null = useMemo(() => {
    if (!pack || !data.series || !checked) return null;
    try { return fitWindow(data.series, pack, undefined, checked, { awcMmPerM: soil?.awcMmPerM }); } catch { return null; }
  }, [pack, data.series, soil, checked]);

  if (!engine || !pack || !data.series || !draft || !def) return null;
  const years = completeYears(data.series);
  const span = years.length ? `${years[0]}–${years[years.length - 1]}` : '';
  const valid = draft.start !== draft.end;
  const dirty = !checked || !same(draft, checked);
  const skipped = skippedSeason(lat);
  const presets = [def, ...(same(def, skipped) ? [] : [skipped])];
  const check = (w: WindowSpec) => { setDraft(w); setChecked(w); };
  const rec = result ? result.all.find((f) => f.cropId === result.recommended) : null;
  const headline = !result || !rec ? null
    : rec.tag === 'rest'
      ? { cls: 'bad', t: <>No crop fits reliably between {fmtMMDD(result.spec.start)} and {fmtMMDD(result.spec.end)}: rest the field.</> }
      : { cls: 'ok', t: <>{cropName(rec.cropId)} fits: matured in time in {rec.matured} of {rec.seasons} past seasons{rec.tag === 'cover' ? ', for soil benefit rather than cash' : ''}.</> };

  return (
    <section className="card section fieldwin" aria-labelledby="fieldwin-title">
      <div className="card-head">
        <div>
          <div className="eyebrow">When is your field free?</div>
          <CardTitle icon={<CalendarRange size={17} />}><span id="fieldwin-title">Field free for a short window?</span></CardTitle>
        </div>
        <div className="row" style={{ gap: 6 }}><Tag t="nasa">NASA POWER {span}</Tag><Tag t="modeled" /></div>
      </div>

      <form className="fw-controls" onSubmit={(e) => { e.preventDefault(); if (valid) setChecked(draft); }}>
        <label className="fw-field"><span>Free from</span>
          <select className="input" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })}>
            {START_OPTS.map((o) => <option key={o} value={o}>{fmtMMDD(o)}</option>)}
          </select>
        </label>
        <label className="fw-field"><span>Until</span>
          <select className="input" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })}>
            {END_OPTS.map((o) => <option key={o} value={o}>{fmtMMDD(o)}</option>)}
          </select>
        </label>
        <button type="submit" className={`btn ${dirty ? 'primary' : ''}`} disabled={!valid || !dirty}><Play size={14} />Check this window</button>
        <div className="fw-presets">
          {presets.map((p) => (
            <button key={p.label} type="button" className={`btn sm ${checked && same(p, checked) ? 'on' : ''}`} aria-pressed={!!checked && same(p, checked)} onClick={() => check(p)}>
              {p.label} · {fmtMMDD(p.start)} → {fmtMMDD(p.end)}
            </button>
          ))}
        </div>
      </form>

      {result && headline && (
        <div className={`fw-results ${dirty ? 'pending' : ''}`} aria-live="polite">
          <p className={`fw-headline ${headline.cls}`}>{headline.t}</p>
          <ol className="fw-list">
            {result.options.map((f) => <Option key={f.cropId} f={f} rec={f.cropId === result.recommended} cur={scenario.currency} />)}
          </ol>
          <div className="fw-legend" aria-hidden><span><i className="ok" />matured, no severe water stress</span><span><i className="warn" />matured, severe water stress</span></div>
        </div>
      )}
      <p className="wi-honest fw-caption">Replay of {span} NASA POWER weather at this grid cell; maturity from growing-degree days and frost; not a forecast.</p>
      <p className="mini fw-method">Each past season is sown on the first day of the window warm enough for the crop, grown on growing-degree days (or its cycle length), and must mature before the window ends and before a killing frost (0 °C; −2 °C for frost-tolerant crops). Rest is recommended when no crop matured without severe water stress in at least 70% of seasons. Cover-crop parameters are demo-unreviewed (FAO-56, SARE).</p>
    </section>
  );
}
