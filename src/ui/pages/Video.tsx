import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Clapperboard, Download, Film, Mic, Music2, Pause, Play, Presentation, RotateCcw, Sparkles } from 'lucide-react';
import type { Route } from '../../App';
import { VideoFrame, VIDEO_DURATION, VIDEO_H, VIDEO_W } from '../video/Scenes';
import timing from '../video/timing.json';
import { CardTitle, Seg } from '../components/common';

const BASE = import.meta.env.BASE_URL;
const MP4 = `${BASE}media/field-shift-30s.mp4`;
const AUDIO = `${BASE}media/field-shift-30s-audio.m4a`;
const POSTER = `${BASE}media/field-shift-poster.jpg`;

/** Scales the fixed 1920×1080 frame to its container. */
function Scaled({ t }: { t: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / VIDEO_W));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: 'var(--r)', background: 'var(--surface-2)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: '0 0' }}><VideoFrame t={t} /></div>
    </div>
  );
}

function LivePlayer() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now() - t * 1000;
    const tick = () => {
      const a = audio.current;
      const now = a && !a.paused && Number.isFinite(a.currentTime) && a.currentTime > 0 ? a.currentTime : (performance.now() - start) / 1000;
      if (now >= VIDEO_DURATION) { setT(VIDEO_DURATION); setPlaying(false); return; }
      setT(now); raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]); // eslint-disable-line
  const toggle = () => {
    const a = audio.current;
    if (playing) { a?.pause(); setPlaying(false); return; }
    const from = t >= VIDEO_DURATION ? 0 : t;
    if (a) { a.currentTime = from; a.play().catch(() => undefined); }
    setT(from); setPlaying(true);
  };
  return (
    <div>
      <Scaled t={t} />
      <audio ref={audio} src={AUDIO} preload="auto" />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary sm" onClick={toggle}>{playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}</button>
        <button className="btn sm" onClick={() => { audio.current?.pause(); setPlaying(false); setT(0); }}><RotateCcw size={14} /> Restart</button>
        <input type="range" min={0} max={VIDEO_DURATION} step={0.05} value={t} style={{ flex: 1, minWidth: 160, accentColor: 'var(--brand)' }} onChange={(e) => { const v = Number(e.target.value); setT(v); if (audio.current) audio.current.currentTime = v; }} aria-label="Scrub" />
        <span className="mini mono">{t.toFixed(1)}s / {VIDEO_DURATION}s</span>
      </div>
    </div>
  );
}

export function VideoPage({ go }: { go: (r: Route) => void }) {
  const [mode, setMode] = useState<'mp4' | 'live'>('mp4');
  const [mp4Ok, setMp4Ok] = useState(true);
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Clapperboard size={13} /> Pitch video</div>
          <h1>Field Shift in 30 seconds</h1>
          <p>Narrated, animated and built from the same real NASA data and engine output as the app. Download the MP4 for the submission, or play the live animated version.</p>
        </div>
        <div className="row">
          <a className="btn primary" href={MP4} download="field-shift-30s.mp4"><Download size={16} /> Download MP4</a>
          <button className="btn" onClick={() => go('pitch')}><Presentation size={16} /> Presentation</button>
        </div>
      </div>
      <div className="grid g-side">
        <div className="card">
          <div className="spread" style={{ marginBottom: 12 }}>
            <Seg value={mode} onChange={setMode} options={[{ v: 'mp4', label: 'MP4 (1080p, with audio)' }, { v: 'live', label: 'Live animated' }]} />
            <span className="chip modeled"><Sparkles /> 30.0 s · 1920×1080 · 30 fps</span>
          </div>
          {mode === 'mp4' && mp4Ok ? (
            <video src={MP4} poster={POSTER} controls playsInline style={{ width: '100%', borderRadius: 'var(--r)', background: 'var(--surface-2)', aspectRatio: '16 / 9' }} onError={() => setMp4Ok(false)} />
          ) : <LivePlayer />}
          {!mp4Ok && mode === 'mp4' && <p className="mini" style={{ marginTop: 8 }}>MP4 not found — showing the live version. Render it with <code>npm run video</code>.</p>}
        </div>
        <div className="card">
          <CardTitle icon={<Film size={17} />} tone="violet">Storyboard</CardTitle>
          <div className="stack">
            {timing.lines.map((l, i) => (
              <div key={l.key} style={{ display: 'flex', gap: 12 }}>
                <span className="mono" style={{ height: 'fit-content' }}>{l.start.toFixed(1)}s</span>
                <div><b style={{ fontSize: '.85rem' }}>{['Hook', 'NASA evidence', 'Cash gap', 'Data fusion', 'Result', 'Close'][i]}</b><div className="mini">“{l.text}”</div></div>
              </div>
            ))}
          </div>
          <hr />
          <div className="mini stack">
            <div className="row" style={{ gap: 8 }}><Mic size={15} /> Voice: Kokoro-82M neural TTS (am_michael, Apache-2.0), generated for this project.</div>
            <div className="row" style={{ gap: 8 }}><Music2 size={15} /> Music & sound design: synthesized from scratch (no samples), ducked under the voice.</div>
            <div className="row" style={{ gap: 8 }}><Sparkles size={15} /> Visuals: deterministic React/SVG scenes rendered frame-by-frame; captions burned in for muted autoplay.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bare 1920×1080 frame for frame-accurate capture (used by scripts/render-video.cjs). */
export function VideoRender() {
  const init = Number(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('t') ?? 0);
  const [t, setT] = useState(init);
  useEffect(() => {
    (window as any).__setT = (v: number) => flushSync(() => setT(v));
    (window as any).__fsReady = true;
  }, []);
  return <div style={{ width: VIDEO_W, height: VIDEO_H, overflow: 'hidden' }}><VideoFrame t={t} /></div>;
}
