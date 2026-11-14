import { useEffect, useState } from 'react';
import { useApp } from './state/AppContext';
import { Overview } from './ui/pages/Overview';
import { FarmPage } from './ui/pages/Farm';
import { ResourcesPage } from './ui/pages/Resources';
import { ComparePage } from './ui/pages/Compare';
import { EvidencePage } from './ui/pages/Evidence';
import { ReportPage } from './ui/pages/Report';
import { MethodsPage } from './ui/pages/Methods';
import { PitchPage } from './ui/pages/Pitch';
import { fmtDate } from './domain/dates';

export type Route = 'overview' | 'farm' | 'resources' | 'compare' | 'evidence' | 'report' | 'methods' | 'pitch';
const NAV: { id: Route; label: string; step?: number }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'farm', label: 'Farm & history', step: 1 },
  { id: 'resources', label: 'Resources', step: 2 },
  { id: 'compare', label: 'Compare plans', step: 3 },
  { id: 'evidence', label: 'Evidence', step: 4 },
  { id: 'report', label: 'Report' },
  { id: 'methods', label: 'Methods' },
  { id: 'pitch', label: '▶ Pitch' },
];

function useRoute(): [Route, (r: Route) => void] {
  const read = () => (window.location.hash.replace('#/', '') || 'overview') as Route;
  const [r, setR] = useState<Route>(read);
  useEffect(() => { const f = () => setR(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return [r, (x) => { window.location.hash = `#/${x}`; window.scrollTo({ top: 0 }); }];
}

export default function App() {
  const [route, go] = useRoute();
  const { scenario, scenarios, select, createNew, data, refreshLive, engine } = useApp();
  if (route === 'pitch') return <PitchPage go={go} />;
  const wDot = data.weatherStatus === 'loading' ? 'load' : data.weatherStatus === 'ready' ? (data.weatherError ? 'warn' : 'ok') : data.weatherStatus === 'error' ? 'err' : '';
  const sDot = data.soilStatus === 'loading' ? 'load' : data.soilStatus === 'ready' ? 'ok' : data.soilStatus === 'error' ? 'warn' : '';
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="logo" href="#/overview"><span className="logo-mark">🛰️</span><span>Field Shift<small>NASA-informed rotation planner</small></span></a>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <button key={n.id} className={route === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                {n.step && <span className="step">{n.step}</span>}{n.label}
              </button>
            ))}
          </nav>
          <div className="scenario-picker">
            <select value={scenario.id} aria-label="Scenario" onChange={(e) => (e.target.value === '__new' ? createNew() : select(e.target.value))}>
              {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new">＋ New farm…</option>
            </select>
          </div>
        </div>
        <div className="statusbar">
          <div className="statusbar-inner">
            <span><span className={`dot ${wDot}`} />NASA POWER: {data.weatherStatus === 'loading' ? 'loading…' : data.series ? `${data.weatherOrigin === 'bundled' ? 'archived snapshot' : data.weatherOrigin === 'cache' ? 'cached' : 'live'} · ${data.series.meta.start.slice(0, 4)}–${fmtDate(data.series.meta.end)}` : data.weatherError ?? '—'}</span>
            <span className="hide-sm"><span className={`dot ${sDot}`} />SoilGrids: {data.soilStatus === 'loading' ? 'loading…' : data.soilGrid ? `${data.soilGrid.texture} · ${data.soilGrid.cached || data.weatherOrigin === 'bundled' ? 'cached' : 'live'}` : data.soilError ? 'unavailable' : '—'}</span>
            {engine && <span className="hide-sm"><span className="dot ok" />Rule pack: {engine.pack.short} v{engine.pack.version}</span>}
            <span style={{ flex: 1 }} />
            <button onClick={refreshLive} disabled={data.weatherStatus === 'loading'} title="Fetch the latest NASA POWER and SoilGrids data for this location">↻ Refresh live NASA data</button>
          </div>
        </div>
      </header>
      <main>
        {route === 'overview' && <Overview go={go} />}
        {route === 'farm' && <FarmPage go={go} />}
        {route === 'resources' && <ResourcesPage go={go} />}
        {route === 'compare' && <ComparePage go={go} />}
        {route === 'evidence' && <EvidencePage go={go} />}
        {route === 'report' && <ReportPage />}
        {route === 'methods' && <MethodsPage />}
        <p className="disclaimer">
          Field Shift is a decision-support prototype built for NASA Space Apps 2026 (Field Shift challenge). It informs rather than decides.
          Weather and soil-moisture context use NASA POWER and NASA GIBS; soil properties use ISRIC SoilGrids; forecasts use Open-Meteo; maps © OpenStreetMap contributors.
          NASA does not endorse this tool. Default prices, yields and demo farms are synthetic; rule packs are not yet reviewed by a local agronomist. AI assistance was used in research, documents and code.
        </p>
      </main>
    </>
  );
}
