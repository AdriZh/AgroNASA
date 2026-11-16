import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Clapperboard, Download, Presentation } from 'lucide-react';
import type { Route } from '../../App';
import { VideoFrame, VIDEO_H, VIDEO_W } from '../video/Scenes';

const BASE = import.meta.env.BASE_URL;
const MP4 = `${BASE}media/field-shift-30s.mp4`;
const POSTER = `${BASE}media/field-shift-poster.jpg`;

export function VideoPage({ go }: { go: (r: Route) => void }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Clapperboard size={13} /> Pitch video</div>
          <h1>Field Shift in 30 seconds</h1>
        </div>
        <div className="row">
          <a className="btn primary" href={MP4} download="field-shift-30s.mp4"><Download size={16} /> Download MP4</a>
          <button className="btn" onClick={() => go('pitch')}><Presentation size={16} /> Presentation</button>
        </div>
      </div>
      <div className="card">
        <video src={MP4} poster={POSTER} controls playsInline preload="metadata" style={{ width: '100%', display: 'block', borderRadius: 'var(--r)', background: 'var(--surface-2)', aspectRatio: '16 / 9' }} />
        <p className="mini" style={{ marginTop: 10, marginBottom: 0 }}>AI-generated: made with Claude (Anthropic); narration by Kokoro-82M text-to-speech (am_michael); music synthesized from scratch. 1920×1080, 30 fps, captions burned in.</p>
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
