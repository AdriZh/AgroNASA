import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import {
  BookOpen, ChevronRight, Clapperboard, FileText, LayoutDashboard, Menu, Presentation, RefreshCw, Sprout,
} from 'lucide-react';
import { useApp } from './state/AppContext';
import { Overview } from './ui/pages/Overview';
import { BrandMark } from './ui/components/Logo';
import { ThemeToggle } from './ui/components/common';
import { ShareButton } from './ui/components/ShareButton';
import { fmtDate } from './domain/dates';
import { TEXTURE_LABEL } from './soil/soil';

// Only the landing route (Overview) is in the main bundle; every other route is its own chunk.
const pages = {
  farm: () => import('./ui/pages/Farm'),
  resources: () => import('./ui/pages/Resources'),
  compare: () => import('./ui/pages/Compare'),
  rotation: () => import('./ui/pages/Rotation'),
  evidence: () => import('./ui/pages/Evidence'),
  report: () => import('./ui/pages/Report'),
  methods: () => import('./ui/pages/Methods'),
  pitch: () => import('./ui/pages/Pitch'),
  video: () => import('./ui/pages/Video'),
};
const FarmPage = lazy(() => pages.farm().then((m) => ({ default: m.FarmPage })));
const ResourcesPage = lazy(() => pages.resources().then((m) => ({ default: m.ResourcesPage })));
const ComparePage = lazy(() => pages.compare().then((m) => ({ default: m.ComparePage })));
const RotationPage = lazy(() => pages.rotation().then((m) => ({ default: m.RotationPage })));
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

/** Skeleton placeholder while a route chunk downloads (usually well under a second). */
function RouteFallback({ full }: { full?: boolean }) {
  return <div className={`route-fallback ${full ? 'full' : ''}`} role="status" aria-label="Loading" />;
}

export type Route = 'overview' | 'farm' | 'resources' | 'compare' | 'rotation' | 'evidence' | 'report' | 'methods' | 'pitch' | 'video' | 'video-render';
type NavItem = { id: Route; label: string; step?: number; icon: ReactNode };
const PLAN: NavItem[] = [
  { id: 'farm', label: 'Farm & history', step: 1, icon: null },
  { id: 'resources', label: 'Resources', step: 2, icon: null },
  { id: 'compare', label: 'Compare plans', step: 3, icon: null },
  { id: 'evidence', label: 'Evidence', step: 4, icon: null },
  { id: 'rotation', label: 'Multi-year & soil N', icon: <Sprout size={16} /> },
];
const MORE: NavItem[] = [
  { id: 'report', label: 'Report & export', icon: <FileText size={16} /> },
  { id: 'methods', label: 'Methods & sources', icon: <BookOpen size={16} /> },
];
const SHOW: NavItem[] = [
  { id: 'pitch', label: 'Presentation', icon: <Presentation size={16} /> },
  { id: 'video', label: '30-second video', icon: <Clapperboard size={16} /> },
];
const TITLES: Record<string, string> = { overview: 'Overview', farm: 'Farm & history', resources: 'Resources', compare: 'Compare plans', rotation: 'Multi-year & soil N', evidence: 'Evidence', report: 'Report & export', methods: 'Methods & sources', video: '30-second video' };

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
  const origin = (ORIGIN[data.weatherOrigin ?? 'live'] ?? 'Live').toLowerCase();
  const nasaLine = data.weatherStatus === 'loading' && !refreshing ? 'NASA POWER · loading…' : data.series ? `NASA POWER ${data.series.meta.start.slice(0, 4)}–${data.series.meta.end.slice(0, 4)}` : data.weatherError ? 'NASA POWER offline · retry' : 'NASA POWER';
  const nasaText = data.weatherStatus === 'loading' && !refreshing ? 'Loading NASA POWER…'
    : data.series ? `${refreshing ? 'Refreshing… · ' : ''}${ORIGIN[data.weatherOrigin ?? 'live']} · ${data.series.meta.start.slice(0, 4)}–${fmtDate(data.series.meta.end)}${data.weatherError && !refreshing ? ' · live update failed (offline?)' : ''}`
    : data.weatherError ? 'Offline · could not download this location (retry with the refresh button)' : '—';
  const farmerTexture = scenario.soil.texture !== 'unknown';
  const typicalSoil = data.soilStatus === 'ready' && !data.soilGrid;
  const sDot = data.soilStatus === 'loading' ? 'load' : typicalSoil ? 'warn' : data.soilStatus === 'ready' ? (data.soilError ? 'warn' : 'ok') : '';
  const soilText = data.soilStatus === 'loading' ? 'Loading…'
    : data.soilGrid ? `${TEXTURE_LABEL[data.soilGrid.texture]} · ${ORIGIN[data.soilOrigin ?? 'live']}`
    : typicalSoil ? `${data.soilError && !/no data/i.test(data.soilError) ? 'SoilGrids offline' : 'No SoilGrids data here'} · ${farmerTexture ? `using your ${TEXTURE_LABEL[scenario.soil.texture].toLowerCase()} texture` : 'using typical loam values (editable)'}`
    : '—';
  const item = (n: NavItem) => (
    <button key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} aria-current={route === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
      {n.step ? <span className="step">{n.step}</span> : n.icon}
      <span>{n.label}</span>
    </button>
  );

  return (
    <div className="app">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navigation">
        <a className="brand-link" href="#/overview"><BrandMark size={32} /><span>Field Shift</span></a>
        <div className="scenario-pick">
          <label htmlFor="scenario" className="caption">Farm scenario</label>
          <select id="scenario" className="input sm" value={scenario.id} onChange={(e) => (e.target.value === '__new' ? createNew() : select(e.target.value))}>
            {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="__new">+ New farm…</option>
          </select>
        </div>
        <nav className="nav-group">
          <button className={`nav-item ${route === 'overview' ? 'active' : ''}`} aria-current={route === 'overview' ? 'page' : undefined} onClick={() => go('overview')}><LayoutDashboard size={16} /><span>Overview</span></button>
        </nav>
        <nav className="nav-group" aria-label="Plan"><div className="nav-title caption">Plan</div>{PLAN.map(item)}</nav>
        <nav className="nav-group" aria-label="Share"><div className="nav-title caption">Share</div>{MORE.map(item)}</nav>
        <nav className="nav-group" aria-label="Present"><div className="nav-title caption">Present</div>{SHOW.map(item)}</nav>
        <div className="side-status">
          <details>
            <summary title={`Data status: NASA POWER ${origin}`}><span className={`dot ${wDot}`} /><span>{nasaLine}</span></summary>
            <div className="popover">
              <dl className="dl">
                <div><dt><span className={`dot ${wDot}`} /> NASA POWER</dt><dd className="wrap">{nasaText}</dd></div>
                <div><dt><span className={`dot ${sDot}`} /> SoilGrids</dt><dd className="wrap">{soilText}</dd></div>
                {engine && <div><dt>Rule pack</dt><dd className="wrap">{engine.pack.short} · v{engine.pack.version}</dd></div>}
              </dl>
            </div>
          </details>
          <button className="btn ghost plain icon sm" onClick={refreshLive} disabled={data.weatherStatus === 'loading'} aria-label="Refresh live NASA data" title="Fetch the latest NASA POWER and SoilGrids data for this location"><RefreshCw size={16} /></button>
        </div>
      </aside>

      <div className="content">
        <header className="appbar">
          <button className="btn ghost plain icon menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="crumbs"><span className="scn hide-sm">{scenario.name}</span><ChevronRight size={14} className="hide-sm" /><b>{TITLES[route] ?? 'Overview'}</b></div>
          <span className="spacer" />
          <div className="appbar-actions">
            <ThemeToggle />
            <ShareButton />
            <button className="btn sm" onClick={() => go('pitch')} aria-label="Present"><Presentation size={16} /><span className="hide-sm">Present</span></button>
          </div>
        </header>
        <main key={route} className="page-enter">
          <Suspense fallback={<RouteFallback />}>
          {route === 'overview' && <Overview go={go} />}
          {route === 'farm' && <FarmPage go={go} />}
          {route === 'resources' && <ResourcesPage go={go} />}
          {route === 'compare' && <ComparePage go={go} />}
          {route === 'rotation' && <RotationPage go={go} />}
          {route === 'evidence' && <EvidencePage go={go} />}
          {route === 'report' && <ReportPage />}
          {route === 'methods' && <MethodsPage />}
          {route === 'video' && <VideoPage go={go} />}
          </Suspense>
          <p className="disclaimer">
            Field Shift is a decision-support prototype for NASA Space Apps 2026 (Field Shift challenge); it informs rather than decides, and NASA does not endorse it. Default prices, yields and demo farms are synthetic; rule packs await local agronomist review. Data: NASA POWER, NASA GIBS, ISRIC SoilGrids, Open-Meteo, maps © OpenStreetMap contributors. AI-assisted: built with Claude (Anthropic) for research, documents, code and design; the video narration voice is Kokoro TTS. <a href="#/methods">Methods & sources</a>
          </p>
        </main>
      </div>
    </div>
  );
}
