import { Download, Printer, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { cropEmoji, cropName } from '../../data/crops';
import { fmtMoney, fmtNum } from '../../domain/units';
import { fmtDate, fmtDayMonth, todayISO } from '../../domain/dates';
import { SOURCES } from '../../data/sources';
import { Callout, pct } from '../components/common';
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
      const j = JSON.parse(await f.text());
      const s: FarmScenario = j.scenario ?? j;
      if (!s.location || !Array.isArray(s.history)) throw new Error('not a Field Shift scenario');
      importScenario(s); setMsg(`Imported “${s.name}”.`);
    } catch (e: any) { setMsg(`Import failed: ${e.message}`); }
  };
  if (!engine) return <Callout tone="info">Loading…</Callout>;
  const plans = [engine.baseline, ...engine.alternatives];
  const cur = sc.currency;
  const cited = new Set<string>(['D1', 'R5', 'R6', 'R8', 'R17', 'R18', 'R19', 'R20', 'R21', ...engine.pack.sources]);
  plans.forEach((p) => p.reasons.forEach((r) => r.refs.forEach((x) => cited.add(x))));

  return (
    <div>
      <div className="page-head no-print">
        <div><div className="eyebrow">Share & keep</div><h1>Two-season plan report</h1><p>Print or save as PDF for the farmer, extension worker or lender. Export/import the scenario as a file. All data stays on this device unless you share the file.</p></div>
        <div className="row">
          <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
          <button className="btn" onClick={download}><Download size={16} /> Export scenario</button>
          <button className="btn" onClick={() => file.current?.click()}><Upload size={16} /> Import</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <button className="btn danger" onClick={async () => { if (confirm('Delete all saved farms, prices and cached data from this device?')) { await deleteAll(); setMsg('All local data deleted; demos restored.'); } }}><Trash2 size={16} /> Delete all local data</button>
        </div>
      </div>
      {msg && <Callout tone="ok">{msg}</Callout>}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="spread">
          <div><div className="eyebrow">Field Shift · decision-support summary</div><h2 style={{ margin: 0 }}>{sc.name}</h2></div>
          <div className="mini" style={{ textAlign: 'right' }}>Generated {fmtDate(todayISO())}<br />Rule pack {engine.pack.id} v{engine.pack.version} ({engine.pack.reviewStatus})</div>
        </div>
        {sc.synthetic && <Callout tone="warn">Synthetic demonstration scenario — not a real farmer’s data.</Callout>}
        <hr />
        <div className="grid g3">
          <div><b>Location</b><div className="mini">{sc.location.label} · {sc.location.lat.toFixed(3)}°, {sc.location.lon.toFixed(3)}°</div><div className="mini">Area {sc.area} {sc.areaUnit} ({engine.areaHa.toFixed(2)} ha)</div></div>
          <div><b>Budget</b><div className="mini">Funds {fmtMoney(sc.availableFunds, cur)} · reserve {fmtMoney(sc.reserve, cur)} · spendable {fmtMoney(engine.baseline.budget.cap, cur)}</div><div className="mini">Confirmed inflows {fmtMoney(engine.baseline.budget.inflowsTotal, cur)} · no harvest income or credit assumed</div></div>
          <div><b>Constraints & priority</b><div className="mini">Irrigation {sc.irrigation}{sc.irrigation === 'yes' ? ` (${sc.irrigationCapacityMm} mm)` : ''} · labor {sc.laborAvailable} · priority {sc.priority}</div><div className="mini">Seed unavailable: {sc.unavailableCrops.map(cropName).join(', ') || 'none'}</div></div>
        </div>
        <hr />
        <b>History</b>
        <div className="mini">{[...sc.history].sort((a, b) => a.year - b.year).map((h) => `${h.year} ${cropName(h.cropId)} (${h.outcome ?? 'unknown'})`).join(' → ') || 'none reported'}</div>

        <h3 style={{ marginTop: 18 }}>Plans compared</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Plan</th><th>Sequence</th><th>Status</th><th className="num">Cash cost</th><th className="num">Headroom</th><th className="num">Severe-stress risk</th><th className="num">Modeled net (median)</th><th>Key reasons</th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.isBaseline ? 'Usual plan' : p.label}</b></td>
                  <td>{cropEmoji(p.crops[0])} {cropName(p.crops[0])} ({p.seasons[0].year}, sow ≈ {fmtDayMonth(p.seasons[0].sowing)}) → {cropEmoji(p.crops[1])} {cropName(p.crops[1])} ({p.seasons[1].year})</td>
                  <td>{p.budget.status}</td>
                  <td className="num">{fmtMoney(p.budget.totalCash, cur)}</td>
                  <td className="num">{fmtMoney(p.budget.headroom, cur)}</td>
                  <td className="num">{pct(p.outcome.pSevereAny)}</td>
                  <td className="num">{fmtMoney(p.outcome.net?.median, cur)}</td>
                  <td className="mini">{p.reasons.filter((r) => r.severity !== 'info').slice(0, 3).map((r) => r.text).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {engine.alternatives.length === 0 && <Callout tone="warn">No feasible alternative under the stated constraints.</Callout>}

        <h3 style={{ marginTop: 18 }}>Past-season review (descriptive, not diagnostic)</h3>
        {reviews.map((r) => <div key={r.season.id} className="mini" style={{ marginBottom: 6 }}><b>{r.season.year} {cropName(r.season.cropId)}:</b> {r.statements.filter((s) => s.kind !== 'limit').map((s) => s.text).join(' ')}</div>)}

        <h3 style={{ marginTop: 18 }}>Climate risk by crop (historical replay {Object.values(engine.risks)[0]?.years[0]?.year}–{Object.values(engine.risks)[0]?.years.slice(-1)[0]?.year})</h3>
        <div className="table-wrap"><table><thead><tr><th>Crop</th><th className="num">Median water-limited yield</th><th className="num">Bad year (P20)</th><th className="num">Severe-stress years</th><th>Typical sowing</th></tr></thead>
          <tbody>{Object.values(engine.risks).map((r) => <tr key={r.cropId}><td>{cropName(r.cropId)}</td><td className="num">{pct(r.medianRel)}</td><td className="num">{pct(r.p20Rel)}</td><td className="num">{pct(r.pSevere)}</td><td>{fmtDayMonth(r.medianSowing)}</td></tr>)}</tbody></table></div>

        <h3 style={{ marginTop: 18 }}>Local checks before acting</h3>
        <ul className="mini">
          <li>Confirm seed availability, variety cycle length and current prices with your supplier (default prices are synthetic).</li>
          <li>Ask a local agronomist to review the rotation rules marked “demo-unreviewed”.</li>
          <li>Consider a soil test before any fertilizer decision; purchase history does not establish present fertility.</li>
          <li>Check soil moisture at sowing; the NASA record is regional (~50 km grid), not your field.</li>
        </ul>

        <h3 style={{ marginTop: 18 }}>Data & sources</h3>
        <div className="mini">NASA POWER {data.series?.meta.start}–{data.series?.meta.end} ({data.weatherOrigin}, retrieved {data.series?.meta.retrievedAt.slice(0, 10)}). Soil: {data.soilGrid ? `SoilGrids ${data.soilGrid.texture}, AWC ${fmtNum(data.soilGrid.awcMmPerM, 0)} mm/m` : 'unavailable'}.</div>
        <ol className="mini" style={{ paddingLeft: 18 }}>
          {SOURCES.filter((s) => cited.has(s.id)).map((s) => <li key={s.id}><b>[{s.id}]</b> {s.title} <span className="muted">— {s.url}</span></li>)}
        </ol>
        <p className="mini">Field Shift informs rather than decides. Modeled values are conditional historical scenarios, not forecasts or guarantees. NASA does not endorse this tool.</p>
      </div>
    </div>
  );
}
