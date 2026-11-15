import { RefreshCw, WifiOff } from 'lucide-react';
import { useApp } from '../../state/AppContext';

/** Shown instead of a blank chart when NASA POWER could not be downloaded for a custom location. */
export function WeatherError() {
  const { data, refreshLive, scenario } = useApp();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return (
    <div className="callout warn" role="alert">
      <WifiOff size={18} />
      <div>
        <b>NASA POWER could not be reached for {scenario.location.label ?? 'this location'}.</b>{' '}
        {offline ? 'This device is offline.' : data.weatherError ? `${data.weatherError}.` : ''} The 25-year daily record is downloaded once per location and then cached on this device.
        The two demo farms work fully offline.
        <div style={{ marginTop: 8 }}>
          <button className="btn sm" onClick={refreshLive} disabled={data.weatherStatus === 'loading'}><RefreshCw size={14} /> Try again</button>
        </div>
      </div>
    </div>
  );
}
