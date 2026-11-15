import { useEffect, useState, type ReactNode } from 'react';
import {
  BookOpen, ChevronRight, Clapperboard, FileText, LayoutDashboard, Menu, Presentation, RefreshCw,
} from 'lucide-react';
import { useApp } from './state/AppContext';
import { Overview } from './ui/pages/Overview';
import { FarmPage } from './ui/pages/Farm';
import { ResourcesPage } from './ui/pages/Resources';
import { ComparePage } from './ui/pages/Compare';
import { EvidencePage } from './ui/pages/Evidence';
import { ReportPage } from './ui/pages/Report';
import { MethodsPage } from './ui/pages/Methods';
import { PitchPage } from './ui/pages/Pitch';
import { VideoPage, VideoRender } from './ui/pages/Video';
import { BrandMark } from './ui/components/Logo';
import { ThemeToggle } from './ui/components/common';
import { fmtDate } from './domain/dates';

export type Route = 'overview' | 'farm' | 'resources' | 'compare' | 'evidence' | 'report' | 'methods' | 'pitch' | 'video' | 'video-render';
type NavItem = { id: Route; label: string; step?: number; icon: ReactNode };
const PLAN: NavItem[] = [
  { id: 'farm', label: 'Farm & history', step: 1, icon: null },
  { id: 'resources', label: 'Resources', step: 2, icon: null },
  { id: 'compare', label: 'Compare plans', step: 3, icon: null },
  { id: 'evidence', label: 'Evidence', step: 4, icon: null },
];
const MORE: NavItem[] = [
  { id: 'report', label: 'Report & export', icon: <FileText size={16} /> },
  { id: 'methods', label: 'Methods & sources', icon: <BookOpen size={16} /> },
];
const SHOW: NavItem[] = [
  { id: 'pitch', label: 'Presentation', icon: <Presentation size={16} /> },
  { id: 'video', label: '30-second video', icon: <Clapperboard size={16} /> },
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
  if (route === 'pitch') return <PitchPage go={go} />;
  if (route === 'video-render') return <VideoRender />;

  const wDot = data.weatherStatus === 'loading' ? 'load' : data.weatherStatus === 'ready' ? (data.weatherError ? 'warn' : 'ok') : data.weatherStatus === 'error' ? 'err' : '';
  const sDot = data.soilStatus === 'loading' ? 'load' : data.soilStatus === 'ready' ? 'ok' : data.soilStatus === 'error' ? 'warn' : '';
  const origin = data.weatherOrigin === 'live' ? 'live' : 'cached';
  const nasaLine = data.weatherStatus === 'loading' ? 'NASA POWER · loading…' : data.series ? `NASA POWER ${data.series.meta.start.slice(0, 4)}–${data.series.meta.end.slice(0, 4)}` : data.weatherError ? 'NASA POWER unavailable' : 'NASA POWER';
  const nasaText = data.weatherStatus === 'loading' ? 'Loading NASA POWER…' : data.series ? `${data.weatherOrigin === 'bundled' ? 'Archived snapshot' : data.weatherOrigin === 'cache' ? 'Cached' : 'Live'} · ${data.series.meta.start.slice(0, 4)}–${fmtDate(data.series.meta.end)}` : data.weatherError ?? '—';
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
                <div><dt><span className={`dot ${sDot}`} /> SoilGrids</dt><dd className="wrap">{data.soilStatus === 'loading' ? 'Loading…' : data.soilGrid ? `${data.soilGrid.texture} · ${data.soilGrid.cached || data.weatherOrigin === 'bundled' ? 'cached' : 'live'}` : data.soilError ? 'Unavailable' : '—'}</dd></div>
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
            {/* Share button slot: ShareButton mounts here, next to Present. */}
            <button className="btn sm" onClick={() => go('pitch')} aria-label="Present"><Presentation size={16} /><span className="hide-sm">Present</span></button>
          </div>
        </header>
        <main key={route} className="page-enter">
          {route === 'overview' && <Overview go={go} />}
          {route === 'farm' && <FarmPage go={go} />}
          {route === 'resources' && <ResourcesPage go={go} />}
          {route === 'compare' && <ComparePage go={go} />}
          {route === 'evidence' && <EvidencePage go={go} />}
          {route === 'report' && <ReportPage />}
          {route === 'methods' && <MethodsPage />}
          {route === 'video' && <VideoPage go={go} />}
          <p className="disclaimer">
            Field Shift is a decision-support prototype for NASA Space Apps 2026 (Field Shift challenge); it informs rather than decides, and NASA does not endorse it. Default prices, yields and demo farms are synthetic; rule packs await local agronomist review. Data: NASA POWER, NASA GIBS, ISRIC SoilGrids, Open-Meteo, maps © OpenStreetMap contributors. AI assistance was used in research, documents, code and media. <a href="#/methods">Methods & sources</a>
          </p>
        </main>
      </div>
    </div>
  );
}
