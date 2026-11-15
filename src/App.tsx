import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import {
  BookOpen, ChevronRight, Clapperboard, FileText, LayoutDashboard, Map as MapIcon, Menu, Microscope, Presentation, RefreshCw, Scale, Wallet,
} from 'lucide-react';
import { useApp } from './state/AppContext';
import { Overview } from './ui/pages/Overview';
import { LogoMark } from './ui/components/Logo';
import { ShareButton } from './ui/components/ShareButton';
import { fmtDate } from './domain/dates';
import { TEXTURE_LABEL } from './soil/soil';

// Only the landing route (Overview) is in the main bundle; every other route is its own chunk.
const pages = {
  farm: () => import('./ui/pages/Farm'),
  resources: () => import('./ui/pages/Resources'),
  compare: () => import('./ui/pages/Compare'),
  evidence: () => import('./ui/pages/Evidence'),
  report: () => import('./ui/pages/Report'),
  methods: () => import('./ui/pages/Methods'),
  pitch: () => import('./ui/pages/Pitch'),
  video: () => import('./ui/pages/Video'),
};
const FarmPage = lazy(() => pages.farm().then((m) => ({ default: m.FarmPage })));
const ResourcesPage = lazy(() => pages.resources().then((m) => ({ default: m.ResourcesPage })));
const ComparePage = lazy(() => pages.compare().then((m) => ({ default: m.ComparePage })));
const EvidencePage = lazy(() => pages.evidence().then((m) => ({ default: m.EvidencePage })));
const ReportPage = lazy(() => pages.report().then((m) => ({ default: m.ReportPage })));
const MethodsPage = lazy(() => pages.methods().then((m) => ({ default: m.MethodsPage })));
const PitchPage = lazy(() => pages.pitch().then((m) => ({ default: m.PitchPage })));
const VideoPage = lazy(() => pages.video().then((m) => ({ default: m.VideoPage })));
const VideoRender = lazy(() => pages.video().then((m) => ({ default: m.VideoRender })));

/** Once the landing page is idle, fetch the routes a visitor is likely to open next so clicks feel instant. */
function usePrefetchRoutes() {
  useEffect(() => {
    const run = () => { for (const k of ['compare', 'farm', 'resources', 'evidence', 'pitch'] as const) pages[k]().catch(() => { /* loaded on demand */ }); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const t = setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 3000 }) : run()), 1200);
    return () => clearTimeout(t);
  }, []);
}

/** Minimal placeholder while a route chunk downloads (usually well under a second). */
function RouteFallback({ full }: { full?: boolean }) {
  return <div className="route-fallback" role="status" aria-label="Loading" style={full ? { position: 'fixed', inset: 0, borderRadius: 0, background: 'var(--space)' } : { minHeight: '60vh' }} />;
}

export type Route = 'overview' | 'farm' | 'resources' | 'compare' | 'evidence' | 'report' | 'methods' | 'pitch' | 'video' | 'video-render';
type NavItem = { id: Route; label: string; step?: number; icon: ReactNode };
const PLAN: NavItem[] = [
  { id: 'farm', label: 'Farm & history', step: 1, icon: <MapIcon size={17} /> },
  { id: 'resources', label: 'Resources', step: 2, icon: <Wallet size={17} /> },
  { id: 'compare', label: 'Compare plans', step: 3, icon: <Scale size={17} /> },
  { id: 'evidence', label: 'Evidence', step: 4, icon: <Microscope size={17} /> },
];
const MORE: NavItem[] = [
  { id: 'report', label: 'Report & export', icon: <FileText size={17} /> },
  { id: 'methods', label: 'Methods & sources', icon: <BookOpen size={17} /> },
];
const SHOW: NavItem[] = [
  { id: 'pitch', label: 'Presentation', icon: <Presentation size={17} /> },
  { id: 'video', label: '30-second video', icon: <Clapperboard size={17} /> },
];
const TITLES: Record<string, string> = { overview: 'Overview', farm: 'Farm & history', resources: 'Resources', compare: 'Compare plans', evidence: 'Evidence', report: 'Report & export', methods: 'Methods & sources', video: '30-second video' };

function useRoute(): [Route, (r: Route) => void] {
  const read = () => ((window.location.hash.replace('#/', '').split('?')[0]) || 'overview') as Route;
  const [r, setR] = useState<Route>(read);
  useEffect(() => { const f = () => setR(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return [r, (x) => { window.location.hash = `#/${x}`; window.scrollTo({ top: 0 }); }];
}

export default function App() {
  const [route, go] = useRoute();
  const [open, setOpen] = useState(false);
  const { scenario, scenarios, select, createNew, data, refreshLive, engine } = useApp();
  useEffect(() => setOpen(false), [route]);
  usePrefetchRoutes();
  if (route === 'pitch') return <Suspense fallback={<RouteFallback full />}><PitchPage go={go} /></Suspense>;
  if (route === 'video-render') return <Suspense fallback={<RouteFallback full />}><VideoRender /></Suspense>;

  // Status labels say honestly where each dataset came from: live, cached on this device, or archived in the app.
  const ORIGIN = { bundled: 'Archived', cache: 'Cached', live: 'Live', typical: 'Typical values' } as const;
  const refreshing = data.weatherStatus === 'loading' && !!data.series;
  const wDot = data.weatherStatus === 'loading' ? 'load' : data.weatherStatus === 'ready' ? (data.weatherError ? 'warn' : 'ok') : data.weatherStatus === 'error' ? 'err' : '';
  const nasaText = data.weatherStatus === 'loading' && !refreshing ? 'Loading NASA POWER…'
    : data.series ? `${refreshing ? 'Refreshing… · ' : ''}${ORIGIN[data.weatherOrigin ?? 'live']} · ${data.series.meta.start.slice(0, 4)}–${fmtDate(data.series.meta.end)}${data.weatherError && !refreshing ? ' · live update failed (offline?)' : ''}`
    : data.weatherError ? 'Offline · could not download this location (retry below)' : '—';
  const farmerTexture = scenario.soil.texture !== 'unknown';
  const typicalSoil = data.soilStatus === 'ready' && !data.soilGrid;
  const sDot = data.soilStatus === 'loading' ? 'load' : typicalSoil ? 'warn' : data.soilStatus === 'ready' ? (data.soilError ? 'warn' : 'ok') : '';
  const soilText = data.soilStatus === 'loading' ? 'Loading…'
    : data.soilGrid ? `${TEXTURE_LABEL[data.soilGrid.texture]} · ${ORIGIN[data.soilOrigin ?? 'live']}`
    : typicalSoil ? `${data.soilError && !/no data/i.test(data.soilError) ? 'SoilGrids offline' : 'No SoilGrids data here'} · ${farmerTexture ? `using your ${TEXTURE_LABEL[scenario.soil.texture].toLowerCase()} texture` : 'using typical loam values (editable)'}`
    : '—';
  const item = (n: NavItem) => (
    <button key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
      {n.step ? <span className="step">{n.step}</span> : n.icon}
      <span>{n.label}</span>
      {n.step && <span className="tail">{n.icon}</span>}
    </button>
  );

  return (
    <div className="app">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navigation">
        <a className="brand" href="#/overview"><LogoMark size={38} /><span><b>Field Shift</b><small>NASA-informed rotation planner</small></span></a>
        <div className="scenario-box">
          <label htmlFor="scenario">Farm scenario</label>
          <select id="scenario" value={scenario.id} onChange={(e) => (e.target.value === '__new' ? createNew() : select(e.target.value))}>
            {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="__new">＋ New farm…</option>
          </select>
        </div>
        <div className="nav-group">
          <button className={`nav-item ${route === 'overview' ? 'active' : ''}`} onClick={() => go('overview')}><LayoutDashboard size={17} /><span>Overview</span></button>
        </div>
        <div className="nav-group"><div className="nav-title">Plan in 4 steps</div>{PLAN.map(item)}</div>
        <div className="nav-group"><div className="nav-title">Share & learn</div>{MORE.map(item)}</div>
        <div className="nav-group"><div className="nav-title">Present</div>{SHOW.map(item)}</div>
        <div className="side-status">
          <div className="line"><span className={`dot ${wDot}`} /><span><b style={{ color: '#fff' }}>NASA POWER</b><br />{nasaText}</span></div>
          <div className="line"><span className={`dot ${sDot}`} /><span><b style={{ color: '#fff' }}>SoilGrids</b><br />{soilText}</span></div>
          {engine && <div className="line"><span className="dot ok" /><span><b style={{ color: '#fff' }}>Rule pack</b><br />{engine.pack.short} · v{engine.pack.version}</span></div>}
          <button onClick={refreshLive} disabled={data.weatherStatus === 'loading'} title="Fetch the latest NASA POWER and SoilGrids data for this location"><RefreshCw size={14} /> Refresh live NASA data</button>
        </div>
      </aside>

      <div className="content">
        <header className="appbar">
          <button className="btn ghost menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="crumbs"><span className="hide-sm">{scenario.name}</span><ChevronRight size={14} className="hide-sm" /><b>{TITLES[route] ?? 'Overview'}</b></div>
          <span className="spacer" />
          {engine && <span className="pill hide-sm"><span className={`dot ${wDot}`} />{engine.pack.short}</span>}
          <ShareButton />
          <button className="btn sm dark" onClick={() => go('pitch')}><Presentation size={15} /> Present</button>
        </header>
        <main key={route} className="fade-in">
          <Suspense fallback={<RouteFallback />}>
          {route === 'overview' && <Overview go={go} />}
          {route === 'farm' && <FarmPage go={go} />}
          {route === 'resources' && <ResourcesPage go={go} />}
          {route === 'compare' && <ComparePage go={go} />}
          {route === 'evidence' && <EvidencePage go={go} />}
          {route === 'report' && <ReportPage />}
          {route === 'methods' && <MethodsPage />}
          {route === 'video' && <VideoPage go={go} />}
          </Suspense>
          <p className="disclaimer">
            Field Shift is a decision-support prototype for NASA Space Apps 2026 (Field Shift challenge). It informs rather than decides.
            Weather and soil-moisture context: NASA POWER and NASA GIBS · soil: ISRIC SoilGrids · forecast: Open-Meteo · maps © OpenStreetMap contributors.
            NASA does not endorse this tool. Default prices, yields and demo farms are synthetic; rule packs await local agronomist review. AI assistance was used in research, documents, code and media.
          </p>
        </main>
      </div>
    </div>
  );
}
