import { Download, Printer, Trash2, Upload } from 'lucide-react';
import { weightsSummary } from '../components/PrioritySliders';
import { CropPair } from '../components/CropIcon';
import { useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { cropName } from '../../data/crops';
import { fmtMoney, fmtNum } from '../../domain/units';
import { fmtDate, fmtDayMonth, todayISO } from '../../domain/dates';
import { SOURCES } from '../../data/sources';
import { Callout, Loading, pct, StatRows, STATUS } from '../components/common';
import { PlanCard } from './Compare';
import { WeatherError } from '../components/NetStatus';
import type { FarmScenario } from '../../domain/types';

export function ReportPage() {
  const { engine, scenario: sc, data, reviews, importScenario, deleteAll } = useApp();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const download = () => {
    const blob = new Blob([JSON.stringify({ format: 'field-shift-scenario@1', exportedAt: new Date().toISOString(), scenario: sc }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `field-shift-${sc.name.replace(/\W+/g, '-').toLowerCase()}.json`; a.click();
    URL.revokeObjectURL(a.href);
  };
  const onImport = async (f: File) => {
    try {
      if (f.size > 2_000_000) throw new Error('file is larger than 2 MB'); const j = JSON.parse(await f.text());
      const s: FarmScenario = j.scenario ?? j;
      if (!s.location || !Array.isArray(s.history)) throw new Error('not a Field Shift scenario');
      importScenario(s); setMsg(`Imported “${s.name}”.`);
    } catch (e: any) { setMsg(`Import failed: ${e.message}`); }
  };
  if (!engine) return data.weatherStatus === 'error' ? <WeatherError /> : <Loading text="Loading NASA POWER…" />;
  const plans = [engine.baseline, ...engine.alternatives];
  const cur = sc.currency;
  const cited = new Set<string>(['D1', 'R5', 'R6', 'R8', 'R17', 'R18', 'R19', 'R20', 'R21', ...engine.pack.sources]);
  plans.forEach((p) => p.reasons.forEach((r) => r.refs.forEach((x) => cited.add(x))));

  const best = engine.alternatives[0] ?? engine.baseline;
  const lines = best.budget.lines.filter((l) => l.cash);
  const yrs = Object.values(engine.risks)[0]?.years ?? [];

  return (
    <div>
      <div className="page-head no-print">
        <div><span className="caption">Share and keep</span><h1>Two-season plan report</h1><p>Print or save as PDF for the farmer, extension worker or lender. Export or import the scenario as a file. All data stays on this device unless you share the file.</p></div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => window.print()}><Printer /> Print / Save PDF</button>
          <button className="btn" onClick={download}><Download /> Export</button>
          <button className="btn" onClick={() => file.current?.click()}><Upload /> Import</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <button className="btn ghost danger" onClick={async () => { if (confirm('Delete all saved farms, prices and cached data from this device?')) { await deleteAll(); setMsg('All local data deleted; demos restored.'); } }}><Trash2 /> Delete all local data</button>
        </div>
      </div>
      {msg && <div className="no-print" style={{ marginBottom: 16 }}><Callout tone="info">{msg}</Callout></div>}

      <article className="card doc">
        <header className="stack-sm">
          <span className="caption">Field Shift · decision-support summary</span>
          <h1>{sc.name}</h1>
          <div className="doc-meta">{sc.location.label} · {sc.location.lat.toFixed(3)}°, {sc.location.lon.toFixed(3)}° · generated {fmtDate(todayISO())} · rule pack {engine.pack.id} v{engine.pack.version} ({engine.pack.reviewStatus})</div>
          {sc.synthetic && <Callout tone="info">Synthetic demonstration scenario, not a real farmer’s data.</Callout>}
        </header>

        <section>
          <h2>Farm and constraints</h2>
          <div style={{ marginTop: 8 }}>
            <StatRows rows={[
              ['Area', `${sc.area} ${sc.areaUnit} (${engine.areaHa.toFixed(2)} ha)`],
              ['Funds · reserve', `${fmtMoney(sc.availableFunds, cur)} · ${fmtMoney(sc.reserve, cur)}`],
              ['Spendable', fmtMoney(engine.baseline.budget.cap, cur)],
              ['Confirmed inflows', `${fmtMoney(engine.baseline.budget.inflowsTotal, cur)} (no harvest income or credit assumed)`, 'wrap'],
              ['Irrigation', `${sc.irrigation}${sc.irrigation === 'yes' ? ` (${sc.irrigationCapacityMm} mm)` : ''}`],
              ['Ranking priorities', weightsSummary(sc.weights), 'wrap'],
              ['Seed unavailable', sc.unavailableCrops.map(cropName).join(', ') || 'none', 'wrap'],
              ['History', [...sc.history].sort((a, b) => a.year - b.year).map((h) => `${h.year} ${cropName(h.cropId)} (${h.outcome ?? 'unknown'})`).join(' → ') || 'none reported', 'wrap'],
            ]} />
          </div>
        </section>

        <section className="stack">
          <h2>{engine.alternatives.length ? 'Best-fit plan' : 'Usual plan'}</h2>
          <div style={{ maxWidth: 420 }}><PlanCard p={best} cur={cur} label={engine.alternatives.length ? 'Best fit' : 'Your usual plan'} tone={engine.alternatives.length ? 'brand' : undefined} best={!!engine.alternatives.length} /></div>
          {engine.alternatives.length === 0 && <Callout tone="warn">No feasible alternative under the stated constraints.</Callout>}
        </section>

        <section className="stack-sm">
          <h2>Plans compared</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Plan</th><th>Sequence</th><th>Status</th><th className="num">Cash cost, {cur}</th><th className="num">Headroom</th><th className="num">Severe</th><th className="num">Net, median</th></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>{p.isBaseline ? 'Usual plan' : p.label}</td>
                    <td className="nowrap"><CropPair crops={p.crops} /></td>
                    <td className="nowrap">{STATUS[p.budget.status].t}</td>
                    <td className="num">{fmtNum(p.budget.totalCash, 0)}</td>
                    <td className="num">{fmtNum(p.budget.headroom, 0)}</td>
                    <td className="num">{pct(p.outcome.pSevereAny)}</td>
                    <td className="num">{fmtNum(p.outcome.net?.median, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mini" style={{ margin: 0, paddingLeft: 16 }}>
            {plans.map((p) => <li key={p.id}><b>{p.isBaseline ? 'Usual plan' : p.label}:</b> {p.reasons.filter((r) => r.severity !== 'info').slice(0, 3).map((r) => r.text).join(' · ') || 'no blocking or warning reasons'}; sow ≈ {fmtDayMonth(p.seasons[0].sowing)} {p.seasons[0].year}.</li>)}
          </ul>
        </section>

        <section className="stack-sm">
          <h2>Cost lines, {engine.alternatives.length ? 'best-fit plan' : 'usual plan'}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th className="num">Quantity</th><th className="num">Total, {cur}</th><th className="num">Due</th></tr></thead>
              <tbody>
                {lines.map((l, i) => <tr key={i}><td className="wrap">S{l.season} {cropName(l.cropId)} · {l.label}</td><td className="num">{fmtNum(l.qty, 1)} {l.unit}</td><td className="num">{l.total == null ? 'missing' : fmtNum(l.total, 0)}</td><td className="num">{fmtDate(l.dueDate)}</td></tr>)}
                <tr className="total"><td>Cash total</td><td /><td className="num">{fmtNum(best.budget.totalCash, 0)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="stack-sm">
          <h2>Climate risk by crop</h2>
          <p className="mini">Modeled water-limited yield from the historical replay, NASA POWER {yrs[0]?.year}–{yrs.slice(-1)[0]?.year}. A replay, not a forecast.</p>
          <div className="table-wrap"><table><thead><tr><th>Crop</th><th className="num">Median yield</th><th className="num">Bad year (P20)</th><th className="num">Severe years</th><th className="num">Typical sowing</th></tr></thead>
            <tbody>{Object.values(engine.risks).map((r) => <tr key={`${r.cropId}:${r.seasonLabel}`}><td>{cropName(r.cropId)}</td><td className="num">{pct(r.medianRel)}</td><td className="num">{pct(r.p20Rel)}</td><td className="num">{pct(r.pSevere)}</td><td className="num">{fmtDayMonth(r.medianSowing)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="stack-sm">
          <h2>Past-season review</h2>
          <p className="mini">Descriptive, not diagnostic.</p>
          {reviews.length ? reviews.map((r) => <p key={r.season.id} style={{ fontSize: 13, lineHeight: '20px' }}><b>{r.season.year} {cropName(r.season.cropId)}:</b> {r.statements.filter((s) => s.kind !== 'limit').map((s) => s.text).join(' ')}</p>) : <p className="mini">No past seasons reported.</p>}
        </section>

        <section className="stack-sm">
          <h2>Local checks before acting</h2>
          <ul className="prose" style={{ margin: 0, paddingLeft: 20 }}>
            <li>Confirm seed availability, variety cycle length and current prices with your supplier (default prices are synthetic).</li>
            <li>Ask a local agronomist to review the rotation rules marked “demo-unreviewed”.</li>
            <li>Consider a soil test before any fertilizer decision; purchase history does not establish present fertility.</li>
            <li>Check soil moisture at sowing; the NASA record is regional (~50 km grid), not your field.</li>
          </ul>
        </section>

        <section className="stack-sm">
          <h2>Data and sources</h2>
          <p className="mini">NASA POWER {data.series?.meta.start}–{data.series?.meta.end} ({data.weatherOrigin === 'bundled' ? 'archived snapshot' : data.weatherOrigin === 'cache' ? 'cached' : 'live'}, retrieved {data.series?.meta.retrievedAt.slice(0, 10)}). Soil: {data.soilGrid ? `SoilGrids ${data.soilGrid.texture}, AWC ${fmtNum(data.soilGrid.awcMmPerM, 0)} mm/m` : 'SoilGrids offline, typical values for the texture class used'}.</p>
          <ol className="mini" style={{ paddingLeft: 20, margin: 0 }}>
            {SOURCES.filter((s) => cited.has(s.id)).map((s) => <li key={s.id}><span className="mono">[{s.id}]</span> <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}
          </ol>
          <p className="mini">Field Shift informs rather than decides. Modeled values are conditional historical scenarios, not forecasts or guarantees. NASA does not endorse this tool.</p>
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}><img src={`${import.meta.env.BASE_URL}media/qr-live.svg`} alt="QR code for https://adrizh.github.io/AgroNASA/" width={72} height={72} className="qr-mini" /><p className="mini" style={{ margin: 0 }}>Open this planner on a phone: <b>adrizh.github.io/AgroNASA</b></p></div>
        </section>
      </article>
    </div>
  );
}
