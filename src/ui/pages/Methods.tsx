import { PACKS } from '../../data/regionPacks';
import { TEAM } from '../../data/team';
import { CropIcon } from '../components/CropIcon';
import { CROPS } from '../../data/crops';
import { SOURCES } from '../../data/sources';
import { Ref, Tag } from '../components/common';

const CODES: [string, string][] = [
  ['BUDGET_EXCEEDED', 'Cash cost exceeds funds − reserve + confirmed inflows; shortfall shown.'],
  ['CASH_TIMING', 'Total fits but cumulative outflow exceeds available cash on a due date.'],
  ['PRICE_MISSING', 'An essential item has no price → “budget not verified”, never zero.'],
  ['RETURN_INTERVAL', 'Same crop before its minimum break (rule G-R1 / SN-R2 / KZ-R2).'],
  ['DISEASE_GROUP', 'Consecutive hosts of a shared soil-borne pathogen (G-R2 / KZ-R3).'],
  ['LEGUME_BENEFIT / FALLOW_BENEFIT', 'Legume or fallow before a cereal (G-R3 / SN-R1 / KZ-R1).'],
  ['MONOCULTURE · SAME_FAMILY', 'Same crop, or same family / shared pest group, in consecutive seasons, including last season → season 1 (G-R6 / G-R7). Never the top-ranked option while a feasible alternation exists.'],
  ['BREAK_CROP · ALTERNATION', 'Cereal → legume, or any other change of crop group (cereal ↔ legume ↔ oilseed ↔ tuber); credited in the ranking (G-R8 / G-R9).'],
  ['SEED_UNAVAILABLE · MARKET_CONSTRAINT · LABOR_LIMIT · IRRIGATION_REQUIRED', 'Hard farmer constraints; never silently relaxed.'],
  ['CLIMATE_UNSUITABLE', 'Season mean temperature outside crop range in most years, or median water-limited yield < 35%.'],
  ['SEASON_TOO_SHORT', 'Spring- or summer-sown crop whose FAO-56 cycle (sum of stage lengths) ends after the first killing autumn frost (NASA POWER Tmin ≤ 0 °C; −2 °C for frost-tolerant crops, as in the field window) in more than half of the replayed years. Frost-free locations and overwintering crops always pass (R8, R41).'],
  ['CLIMATE_RISK_HIGH · HEAT_EXPOSURE · FROST_RISK', 'Warnings from the NASA replay (≥35% severe years; ≥30% years with ≥3 hot days at flowering; ≥20% years with frost after emergence).'],
  ['SOIL_PH', 'SoilGrids or lab pH outside the crop’s usual range (warning only).'],
  ['SEASON_OVERLAP', 'Two-season systems: the first crop is still in the field when the second must be sown.'],
  ['HISTORY_INCOMPLETE · CLIMATE_CONTEXT_ONLY · UNREVIEWED_RULES · SYNTHETIC_PRICES', 'Transparency notes attached to every result.'],
];

export function MethodsPage() {
  return (
    <div>
      <div className="page-head"><div><span className="caption">Validity</span><h1>Methods, rules and sources</h1><p>A transparent, deterministic pipeline: no black-box model and no LLM in the recommendation path. Every visible “why” points to an input, a formula or a rule or evidence ID.</p></div></div>

      <article className="card">
        <div className="prose" style={{ margin: '0 auto' }}>
          <h2 style={{ marginTop: 0 }}>1. Pipeline</h2>
          <ol>
            <li><b>Normalize inputs.</b> Area to ha (acre 0.4047, m² 0.0001); fertilizer to product kg, rate per treated ha, label N/P₂O₅/K₂O; unknowns stay null.</li>
            <li><b>NASA weather profile.</b> POWER daily PRECTOTCORR, T2M, T2M_MAX/MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT/GWETTOP; validated for fill values (−999), duplicates and implausible values; cached per MERRA-2 grid cell.</li>
            <li><b>Sowing date per year.</b> Sahel and tropics: first day ≥ window start with 3-day rain ≥ 20 mm and no dry spell &gt; 7 days in the next 30 (Sivakumar 1988). Temperate: first day the 5-day mean T2M reaches the crop threshold.</li>
            <li><b>Water-balance replay.</b> FAO-56 Penman–Monteith ET₀ (Hargreaves fallback); single-Kc crop curve; root-zone depletion with readily-available water p·TAW; Ks stress; 120-day antecedent spin-up (365 days after fallow); runoff 20% of rain above 25 mm/day; optional irrigation to the declared cap.</li>
            <li><b>Yield response.</b> FAO-66 seasonal Ky, below. Coherent consecutive year pairs (Y, Y+1) are replayed for two-season plans.</li>
            <li><b>Candidates and rules.</b> Every two-season pair from the pack (fallow optional) is checked against return intervals, disease groups, farmer constraints and climate screening, each with a reason code.</li>
            <li><b>Costs and feasibility.</b> Integer minor units; cumulative cash is checked at each due date with confirmed inflows only.</li>
            <li><b>Rank feasible plans</b> by the chosen priority with a documented deterministic tie-break; always show the baseline; show 0, 1 or 2 alternatives and never invent one.</li>
          </ol>
          <div className="formula">{'1 − Ya/Ym = Ky × (1 − ΣETa / ΣETc)\nyield = attainable × Ya/Ym'}</div>
          <div className="formula">{'cost      = qty/ha × area × unit price\nspendable = funds − reserve\nheadroom  = spendable + confirmed inflows − cash cost'}</div>

          <h2>2. Soil water</h2>
          <p>Available water capacity (AWC, mm/m) comes from the farmer’s texture (FAO-56 Table 19 mid-range) or, if unknown, from SoilGrids sand, clay and organic carbon (0–60 cm weighted) via the Saxton &amp; Rawls (2006) pedotransfer functions. Roots grow linearly from 0.15 m to the crop maximum by the end of the development stage. <Ref id="R20" /> <Ref id="R21" /> <Ref id="R8" /></p>
          <div className="formula">{'TAW = AWC × current root depth\nRAW = p × TAW'}</div>

          <h2>3. Economics</h2>
          <p>Past fertilizer purchases are history, not costs charged to the new plan. Non-cash family labor is shown but excluded from cash affordability. Modeled revenue (yield × your price) is reported separately and never used to decide affordability.</p>

          <h2>4. What is observed and what is modeled</h2>
          <div className="table-wrap"><table><tbody>
            <tr><td><Tag t="nasa" /></td><td className="wrap">Rain, temperature, humidity, wind, radiation, soil wetness (reanalysis)</td></tr>
            <tr><td><Tag t="modeled" /></td><td className="wrap">ET₀, sowing dates, soil-water balance, water-limited yield, revenue range</td></tr>
            <tr><td><Tag t="soilgrids" /></td><td className="wrap">Soil properties (modeled map)</td></tr>
            <tr><td><Tag t="farmer" /></td><td className="wrap">History, fertilizer, budget, constraints, prices you edit</td></tr>
            <tr><td><Tag t="synthetic" /></td><td className="wrap">Default prices, yields, demo farms</td></tr>
          </tbody></table></div>

          <h2>5. Verification</h2>
          <p>Automated tests (acceptance and world coverage, <code>npm test</code>) reproduce the planning pack: 100 kg / 2 ha = 50 kg/ha; 46% N → 23 kg N/ha; 900 passes / 900.01 fails; synthetic fixture headroom 40/120/210; D1 has 9,131 records; Jun–Oct 2002 = 308.92 mm and 2009 = 975.63 mm; ≥10-day dry spells 20/25 vs 1/25; FAO-56 Example 18 ET₀ ≈ 3.9 mm/day; fill values never become zero; no causal language in reviews.</p>

          <h2>6. World coverage</h2>
          <p>Any point on Earth works: NASA POWER provides daily weather for every 0.5° × 0.625° cell. The country (OpenStreetMap reverse geocoding or the farmer’s choice) selects one of {PACKS.length - 1} regional farming-system packs: one-season (Sahel, Ethiopia, Southern Africa, Mediterranean, Australia, steppe), two seasons in one year (East Africa long/short rains, South Asia Kharif/Rabi, Southeast Asia wet/dry, North China Plain, Brazil summer and safrinha) or autumn- and spring-sown temperate systems (Europe, North America, Central Asia). It falls back to a global screening pack whose season is derived from the NASA climatology. Two-season plans replay both seasons of the same historical year; a crop still in the field at the next sowing is blocked (<code>SEASON_OVERLAP</code>).</p>
          <p>Prices: crop sale prices are FAOSTAT producer prices for the country (latest year ≥ 2010) or the FAOSTAT global median, converted at the FAOSTAT exchange rate. Input costs are one synthetic per-crop template scaled by region and converted to local currency. Every value is editable. <Ref id="R33" /></p>

          <h2>7. NASA values at the field pixel</h2>
          <p>GIBS serves lossless PNG tiles plus a published colormap for each product. Field Shift reads the pixel under the field (3×3 median for continuous layers) and maps its colour back to the data value: MODIS Terra NDVI 16-day (≈300 m, 2000→now), MODIS IGBP land cover, SMAP L4 root-zone soil moisture (≈9 km, 2015→now) and GRACE/GRACE-FO total water storage (mascons, 2002–2022). Values are quantized to the colormap bins (NDVI 0.005, SMAP 0.003 m³/m³, GRACE 0.25 cm). NDVI season peaks are correlated with the FAO-56 replay to check the model against observation. Natural events come from NASA EONET. <Ref id="R35" /> <Ref id="R36" /></p>

          <h2>8. Privacy</h2>
          <p>Crop history, fertilizer records, prices and budget are stored in this browser (localStorage); public datasets are cached in IndexedDB. Requests to NASA POWER, SoilGrids, Open-Meteo and the map and geocoder contain only coordinates or a place name; providers still see network information. Export, import and delete-all are on the Report page. No account, no tracking.</p>

          <h2>9. Team</h2>
          <p>{TEAM.join(' · ')}. Developed alongside the team's Fieldwise prototype, which inspired some ideas.</p>

          <h2>10. AI disclosure and limits</h2>
          <p>AI-assisted: Claude (Anthropic) was used for research synthesis, documents, code, design and analysis; the 30-second video narration uses the Kokoro TTS AI voice and the video is labeled “AI-generated”. Recommendations are produced by fixed rules and published formulas, not by a language model. Not validated agronomic advice: rule packs await local review; no user tests or field validation are claimed. NASA data is credited; NASA does not endorse this project.</p>
        </div>
      </article>

      <section className="card section">
        <div className="card-head"><h2>Reason codes</h2></div>
        <div className="table-wrap"><table><thead><tr><th>Code</th><th>Meaning</th></tr></thead><tbody>{CODES.map(([c, d]) => <tr key={c}><td className="wrap" style={{ verticalAlign: 'top', paddingTop: 10, paddingBottom: 10, maxWidth: 320 }}><span className="mono" style={{ overflowWrap: 'anywhere' }}>{c}</span></td><td className="wrap">{d}</td></tr>)}</tbody></table></div>
      </section>

      <section className="card section">
        <div className="card-head"><h2>Regional rule packs</h2></div>
        {PACKS.map((p) => (
          <details key={p.id} className="disclose group">
            <summary>{p.name}<span className="chip">v{p.version}</span><span className="chip">{p.reviewStatus}</span></summary>
            <div className="body stack-sm">
              <p className="mini">{p.description}</p>
              <div className="table-wrap"><table><thead><tr><th>Rule</th><th>Kind</th><th>Text</th><th>Sources</th><th>Reviewed</th></tr></thead>
                <tbody>{p.rules.map((r) => <tr key={r.id}><td className="mono">{r.id}</td><td>{r.kind}</td><td className="wrap">{r.text}</td><td><span className="chips">{r.sources.map((x) => <Ref key={x} id={x} />)}</span></td><td>{r.reviewed ? 'yes' : 'no'}</td></tr>)}</tbody></table></div>
              <div className="table-wrap"><table><thead><tr><th>Crop</th><th>Kc ini/mid/end</th><th>Stages (d)</th><th className="num">Root m</th><th className="num">p</th><th className="num">Ky</th><th className="num">Heat °C</th><th>Season T °C</th><th className="num">Return</th></tr></thead>
                <tbody>{p.crops.filter((c) => c !== 'fallow').map((c) => { const d = CROPS[c]; return <tr key={c}><td><span className="crop-name"><CropIcon id={c} size={18} />{d.name}</span></td><td>{d.kc.join(' / ')}</td><td>{d.stages.join('+')}</td><td className="num">{d.rootDepthM}</td><td className="num">{d.p}</td><td className="num">{d.ky}</td><td className="num">{d.heatThresholdC}</td><td>{d.tMeanRange.join('–')}</td><td className="num">{d.minReturnSeasons}</td></tr>; })}</tbody></table></div>
            </div>
          </details>
        ))}
      </section>

      <section className="card section">
        <div className="card-head"><h2>Evidence register</h2></div>
        <div className="table-wrap"><table><thead><tr><th>ID</th><th>Source</th><th>Used as</th><th>Limits</th></tr></thead>
          <tbody>{SOURCES.map((s) => <tr key={s.id}><td className="mono" style={{ verticalAlign: 'top', paddingTop: 10 }}>{s.id}</td><td className="wrap" style={{ verticalAlign: 'top', paddingTop: 10, paddingBottom: 10 }}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></td><td style={{ verticalAlign: 'top', paddingTop: 10 }}>{KIND[s.kind]}</td><td className="wrap mini" style={{ verticalAlign: 'top', paddingTop: 10, paddingBottom: 10 }}>{s.limits}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

const KIND: Record<string, string> = { nasa: 'NASA data', data: 'Dataset', science: 'Science', context: 'Context', product: 'Product' };
