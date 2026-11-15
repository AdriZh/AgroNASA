// One-click share: copies a link that restores this exact scenario (and the what-if climate setting).
// Also restores scenarios from incoming links (#/compare?s=…) and reports the outcome in a toast.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Link2, X } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { getWhatIf, shareUrl, useShareLinkLoader, useWhatIfResetOnScenarioChange, type ShareLoadEvent } from '../../state/share';

type Toast = { tone: 'ok' | 'warn'; text: string; url?: string };

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function ShareButton() {
  const { scenario } = useApp();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((t: Toast, ms = 3200) => {
    setToast(t);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useWhatIfResetOnScenarioChange();
  useShareLinkLoader(useCallback((e: ShareLoadEvent) => {
    if (e.ok) show({ tone: 'ok', text: `Shared scenario opened: ${e.name}` }, 4000);
    else show({ tone: 'warn', text: `This share link couldn’t be read (${e.error}). Your current scenario is unchanged.` }, 7000);
  }, [show]));

  const onShare = async () => {
    const url = shareUrl(scenario, getWhatIf());
    const ok = await copyText(url);
    if (ok) show({ tone: 'ok', text: 'Link copied', url });
    else show({ tone: 'warn', text: 'Copy this link:', url }, 12000);
  };

  return (
    <>
      <button className="btn sm share-btn" onClick={onShare} title="Copy a link that reopens this exact scenario and what-if setting" data-share-button>
        <Link2 size={15} /> Share
      </button>
      {toast && createPortal(
        <div className={`share-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.tone === 'ok' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <div className="share-toast-body">
            <b>{toast.text}</b>
            {toast.url && (toast.tone === 'warn'
              ? <input className="input sm" readOnly value={toast.url} onFocus={(e) => e.currentTarget.select()} autoFocus />
              : <span className="share-toast-url">{toast.url.length > 72 ? `${toast.url.slice(0, 72)}…` : toast.url} · {toast.url.length} chars</span>)}
          </div>
          <button className="btn ghost sm" aria-label="Dismiss" onClick={() => setToast(null)}><X size={14} /></button>
        </div>,
        document.body,
      )}
    </>
  );
}
