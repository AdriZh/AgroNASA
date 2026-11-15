// Onboarding map: draw the field outline (tap the corners) or drop a pin. Base map only — no data layers.
import { useEffect, useRef } from 'react';
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useChartTheme } from './charts';

export type FieldMapMode = 'draw' | 'pin';
type Pt = [number, number];

function Follow({ lat, lon, boundary, focusKey }: { lat: number; lon: number; boundary?: Pt[] | null; focusKey: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (boundary && boundary.length >= 3) map.fitBounds(boundary as LatLngBoundsExpression, { padding: [40, 40], maxZoom: 17, animate: !first.current });
    else map.setView([lat, lon], first.current ? map.getZoom() : Math.max(map.getZoom(), 14), { animate: !first.current });
    first.current = false;
    // re-fit only when the farm moves or a new location is chosen, not on every vertex
  }, [focusKey]);
  return null;
}

function Clicks({ mode, draft, onPin, onDraft, onClose }: { mode: FieldMapMode; draft: Pt[]; onPin: (p: Pt) => void; onDraft: (d: Pt[]) => void; onClose: () => void }) {
  const map = useMapEvents({
    click: (e) => {
      const p: Pt = [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))];
      if (mode === 'pin') { onPin(p); return; }
      // tapping near the first corner closes the outline
      if (draft.length >= 3) {
        const a = map.latLngToContainerPoint(draft[0]), b = map.latLngToContainerPoint(p);
        if (a.distanceTo(b) < 14) { onClose(); return; }
      }
      onDraft([...draft, p]);
    },
  });
  useEffect(() => { if (mode === 'draw') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable(); }, [mode, map]);
  return null;
}

export function FieldMap({ lat, lon, boundary, mode, draft, onPin, onDraft, onClose, focusKey }: {
  lat: number; lon: number; boundary?: Pt[] | null; mode: FieldMapMode; draft: Pt[];
  onPin: (p: Pt) => void; onDraft: (d: Pt[]) => void; onClose: () => void; focusKey: number;
}) {
  const t = useChartTheme();
  const drawing = mode === 'draw' && draft.length > 0;
  return (
    <div className={`field-map ${mode === 'draw' ? 'drawing' : ''}`}>
      <MapContainer center={[lat, lon]} zoom={boundary?.length ? 15 : 13} scrollWheelZoom style={{ height: '100%', width: '100%' }} worldCopyJump>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {!drawing && boundary && boundary.length >= 3 && <Polygon positions={boundary} pathOptions={{ color: t.brand, weight: 2.5, fillColor: t.brand, fillOpacity: 0.18 }} />}
        {drawing && (
          <>
            {draft.length >= 3 && <Polygon positions={draft} pathOptions={{ color: t.brand, weight: 0, fillColor: t.brand, fillOpacity: 0.12 }} />}
            <Polyline positions={draft} pathOptions={{ color: t.brand, weight: 2.5, dashArray: '6 4' }} />
            {draft.map((p, i) => <CircleMarker key={i} center={p} radius={i === 0 && draft.length >= 3 ? 8 : 5} pathOptions={{ color: t.surface, weight: 2, fillColor: t.brand, fillOpacity: 1 }} />)}
          </>
        )}
        {!drawing && <CircleMarker center={[lat, lon]} radius={7} pathOptions={{ color: t.surface, weight: 3, fillColor: t.brand, fillOpacity: 1 }} />}
        <Follow lat={lat} lon={lon} boundary={boundary} focusKey={focusKey} />
        <Clicks mode={mode} draft={draft} onPin={onPin} onDraft={onDraft} onClose={onClose} />
      </MapContainer>
    </div>
  );
}
