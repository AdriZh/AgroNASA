import { Bot, Lock } from 'lucide-react';
import { PACKS } from '../../data/regionPacks';
import { CROPS } from '../../data/crops';
import { SOURCES } from '../../data/sources';
import { CardTitle, Ref, Tag } from '../components/common';

const CODES: [string, string][] = [
  ['BUDGET_EXCEEDED', 'Cash cost exceeds funds − reserve + confirmed inflows; shortfall shown.'],
  ['CASH_TIMING', 'Total fits but cumulative outflow exceeds available cash on a due date.'],
  ['PRICE_MISSING', 'An essential item has no price → “budget not verified”, never zero.'],
  ['RETURN_INTERVAL', 'Same crop before its minimum break (rule G-R1 / SN-R2 / KZ-R2).'],
  ['DISEASE_GROUP', 'Consecutive hosts of a shared soil-borne pathogen (G-R2 / KZ-R3).'],
  ['LEGUME_BENEFIT / FALLOW_BENEFIT', 'Legume or fallow before a cereal (G-R3 / SN-R1 / KZ-R1).'],
  ['SEED_UNAVAILABLE · MARKET_CONSTRAINT · LABOR_LIMIT · IRRIGATION_REQUIRED', 'Hard farmer constraints; never silently relaxed.'],
  ['CLIMATE_UNSUITABLE', 'Season mean temperature outside crop range in most years, or median water-limited yield < 35%.'],
  ['CLIMATE_RISK_HIGH · HEAT_EXPOSURE · FROST_RISK', 'Warnings from the NASA replay (≥35% severe years; ≥30% years with ≥3 hot days at flowering; ≥20% years with frost after emergence).'],
  ['SOIL_PH', 'SoilGrids or lab pH outside the crop’s usual range (warning only).'],
  ['HISTORY_INCOMPLETE · CLIMATE_CONTEXT_ONLY · UNREVIEWED_RULES · SYNTHETIC_PRICES', 'Transparency notes attached to every result.'],
];

export function MethodsPage() {
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow">Validity</div><h1>Methods, rules & sources</h1><p>A transparent, deterministic pipeline — no black-box model and no LLM in the recommendation path. Every visible “why” points to an input, a formula or a rule/evidence ID.</p></div></div>

      <div className="grid g2">
        <div className="card">
          <h3>1 · Pipeline</h3>
          <ol className="mini" style={{ paddingLeft: 18 }}>
            <li><b>Normalize inputs</b> — area to ha (acre 0.4047, m² 0.0001); fertilizer to product kg, rate per treated ha, label N/P₂O₅/K₂O; unknowns stay null.</li>
            <li><b>NASA weather profile</b> — POWER daily PRECTOTCORR, T2M, T2M_MAX/MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT/GWETTOP; validated for fill values (−999), duplicates and implausible values; cached per MERRA-2 grid cell.</li>
            <li><b>Sowing date per year</b> — Sahel/tropics: first day ≥ window start with 3-day rain ≥ 20 mm and no dry spell &gt; 7 days in the next 30 (Sivakumar 1988). Temperate: first day the 5-day mean T2M reaches the crop threshold.</li>
            <li><b>Water-balance replay</b> — FAO-56 Penman–Monteith ET₀ (Hargreaves fallback); single-Kc crop curve; root-zone depletion with readily-available water p·TAW; Ks stress; 120-day antecedent spin-up (365 days after fallow); runoff 20% of rain above 25 mm/day; optional irrigation to the declared cap.</li>
            <li><b>Yield response</b> — FAO-66 seasonal Ky: 1 − Ya/Ym = Ky (1 − ΣETa/ΣETc). Yield = attainable × Ya/Ym. Coherent consecutive year pairs (Y, Y+1) are replayed for two-season plans.</li>
            <li><b>Candidates & rules</b> — every two-season pair from the pack (fallow optional) is checked against return intervals, disease groups, farmer constraints and climate screening, each with a reason code.</li>
            <li><b>Costs & feasibility</b> — cost = qty/ha × area × unit price, in integer minor units; spendable = funds − reserve; cumulative cash checked at each due date with confirmed inflows only.</li>
            <li><b>Rank feasible plans</b> by the chosen priority with a documented deterministic tie-break; show the baseline always; show 0, 1 or 2 alternatives — never invent one.</li>
          </ol>
        </div>
        <div className="card">
          <h3>2 · Soil water</h3>
          <p className="mini">Available water capacity (AWC, mm/m) comes from the farmer’s texture (FAO-56 Table 19 mid-range) or, if unknown, from SoilGrids sand/clay/organic carbon (0–60 cm weighted) via the Saxton & Rawls (2006) pedotransfer functions. TAW = AWC × current root depth; roots grow linearly from 0.15 m to the crop maximum by the end of the development stage. <Ref id="R20" /> <Ref id="R21" /> <Ref id="R8" /></p>
          <h3 style={{ marginTop: 14 }}>3 · Economics</h3>
          <p className="mini">Past fertilizer purchases are history, not costs charged to the new plan. Non-cash family labor is shown but excluded from cash affordability. Modeled revenue (yield × your price) is reported separately and never used to decide affordability.</p>
          <h3 style={{ marginTop: 14 }}>4 · What is observed vs modeled</h3>
          <div className="row"><Tag t="nasa" /><span className="mini">rain, temperature, humidity, wind, radiation, soil wetness (reanalysis)</span></div>
          <div className="row"><Tag t="modeled" /><span className="mini">ET₀, sowing dates, soil-water balance, water-limited yield, revenue range</span></div>
          <div className="row"><Tag t="soilgrids" /><span className="mini">soil properties (modeled map)</span></div>
          <div className="row"><Tag t="farmer" /><span className="mini">history, fertilizer, budget, constraints, prices you edit</span></div>
          <div className="row"><Tag t="synthetic" /><span className="mini">default prices, yields, demo farms</span></div>
          <h3 style={{ marginTop: 14 }}>5 · Verification</h3>
          <p className="mini">25 automated acceptance tests (<code>npm test</code>) reproduce the planning pack: 100 kg / 2 ha = 50 kg/ha; 46% N → 23 kg N/ha; 900 passes / 900.01 fails; synthetic fixture headroom 40/120/210; D1 has 9,131 records; Jun–Oct 2002 = 308.92 mm and 2009 = 975.63 mm; ≥10-day dry spells 20/25 vs 1/25; FAO-56 Example 18 ET₀ ≈ 3.9 mm/day; fill values never become zero; no causal language in reviews.</p>
        </div>
      </div>

      <div className="card section">
        <h3>Reason codes</h3>
        <div className="table-wrap"><table><tbody>{CODES.map(([c, d]) => <tr key={c}><td><code>{c}</code></td><td className="mini">{d}</td></tr>)}</tbody></table></div>
      </div>

      <div className="card section">
        <h3>Regional rule packs</h3>
        {PACKS.map((p) => (
          <details key={p.id} style={{ marginTop: 8 }}>
            <summary>{p.name} — v{p.version} · <span className="badge warn" style={{ fontSize: '.7rem' }}>{p.reviewStatus}</span></summary>
            <p className="mini" style={{ marginTop: 6 }}>{p.description}</p>
            <div className="table-wrap"><table><thead><tr><th>Rule</th><th>Kind</th><th>Text</th><th>Sources</th><th>Reviewed</th></tr></thead>
              <tbody>{p.rules.map((r) => <tr key={r.id}><td><code>{r.id}</code></td><td>{r.kind}</td><td className="mini">{r.text}</td><td>{r.sources.map((s) => <Ref key={s} id={s} />)}</td><td>{r.reviewed ? 'yes' : 'no'}</td></tr>)}</tbody></table></div>
            <div className="table-wrap" style={{ marginTop: 8 }}><table><thead><tr><th>Crop</th><th>Kc ini/mid/end</th><th>Stages (d)</th><th>Root m</th><th>p</th><th>Ky</th><th>Heat °C</th><th>Season T °C</th><th>Return</th></tr></thead>
              <tbody>{p.crops.filter((c) => c !== 'fallow').map((c) => { const d = CROPS[c]; return <tr key={c}><td>{d.emoji} {d.name}</td><td>{d.kc.join(' / ')}</td><td>{d.stages.join('+')}</td><td>{d.rootDepthM}</td><td>{d.p}</td><td>{d.ky}</td><td>{d.heatThresholdC}</td><td>{d.tMeanRange.join('–')}</td><td>{d.minReturnSeasons}</td></tr>; })}</tbody></table></div>
          </details>
        ))}
      </div>

      <div className="card section">
        <h3>Evidence register</h3>
        <div className="table-wrap"><table><thead><tr><th>ID</th><th>Source</th><th>Limits</th></tr></thead>
          <tbody>{SOURCES.map((s) => <tr key={s.id}><td><code>{s.id}</code></td><td className="mini"><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></td><td className="mini">{s.limits}</td></tr>)}</tbody></table></div>
      </div>

      <div className="grid g2 section">
        <div className="card"><CardTitle icon={<Lock size={17} />} tone="sky">Privacy</CardTitle><p className="mini">Crop history, fertilizer records, prices and budget are stored in this browser (localStorage); public datasets are cached in IndexedDB. Requests to NASA POWER, SoilGrids, Open-Meteo and the map/geocoder contain only coordinates or a place name — providers still see network information. Export, import and delete-all are on the Report page. No account, no tracking.</p></div>
        <div className="card"><CardTitle icon={<Bot size={17} />} tone="violet">AI disclosure & limits</CardTitle><p className="mini">AI assistance was used for research synthesis, documents and code. Recommendations are produced by fixed rules and published formulas, not by a language model. Not validated agronomic advice: rule packs await local review; no user tests or field validation are claimed. NASA data is credited; NASA does not endorse this project.</p></div>
      </div>
    </div>
  );
}
