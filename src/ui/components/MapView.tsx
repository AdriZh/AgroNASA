import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { powerGridCell } from '../../weather/power';
import { addDays, todayISO } from '../../domain/dates';

export interface GibsLayer { id: string; label: string; layer: string; matrix: string; ext: 'png' | 'jpg'; lagDays: number; legend: string; source: string }
export const GIBS_LAYERS: GibsLayer[] = [
  { id: 'none', label: 'Map only', layer: '', matrix: '', ext: 'png', lagDays: 0, legend: '', source: '' },
  { id: 'truecolor', label: 'True colour (MODIS Terra)', layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', matrix: 'GoogleMapsCompatible_Level9', ext: 'jpg', lagDays: 1, legend: 'Daily corrected reflectance, ~250 m', source: 'R22' },
  { id: 'ndvi', label: 'Vegetation NDVI (MODIS 8-day)', layer: 'MODIS_Terra_NDVI_8Day', matrix: 'GoogleMapsCompatible_Level9', ext: 'png', lagDays: 10, legend: 'Brown = bare/dry · green = dense vegetation', source: 'R24' },
  { id: 'smap', label: 'Root-zone soil moisture (SMAP L4)', layer: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', matrix: 'GoogleMapsCompatible_Level6', ext: 'png', lagDays: 5, legend: 'Yellow/brown = dry · blue = wet, ~9 km', source: 'R23' },
  { id: 'imerg', label: 'Precipitation rate (GPM IMERG)', layer: 'IMERG_Precipitation_Rate', matrix: 'GoogleMapsCompatible_Level6', ext: 'png', lagDays: 2, legend: 'Satellite precipitation estimate, ~10 km', source: 'R25' },
  { id: 'lst', label: 'Land surface temp. (MODIS day)', layer: 'MODIS_Terra_Land_Surface_Temp_Day', matrix: 'GoogleMapsCompatible_Level7', ext: 'png', lagDays: 2, legend: 'Daytime land surface temperature, ~1 km', source: 'R22' },
];

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lon], map.getZoom(), { animate: true }); }, [lat, lon, map]);
  return null;
}
function Picker({ onPick }: { onPick?: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4))) });
  return null;
}

export function MapView({ lat, lon, onPick, tall, defaultLayer = 'none', zoom = 8, showControls = true }: { lat: number; lon: number; onPick?: (lat: number, lon: number) => void; tall?: boolean; defaultLayer?: string; zoom?: number; showControls?: boolean }) {
  const [layerId, setLayerId] = useState(defaultLayer);
  const layer = GIBS_LAYERS.find((l) => l.id === layerId)!;
  const [date, setDate] = useState(() => addDays(todayISO(), -(layer.lagDays || 1)));
  const [opacity, setOpacity] = useState(0.75);
  useEffect(() => { setDate(addDays(todayISO(), -(layer.lagDays || 1))); }, [layerId]); // eslint-disable-line
  const cell = useMemo(() => powerGridCell(lat, lon), [lat, lon]);
  const maxNative = layer.matrix ? Number(layer.matrix.split('Level')[1]) : 19;
  const url = layer.layer ? `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.layer}/default/${date}/${layer.matrix}/{z}/{y}/{x}.${layer.ext}` : '';

  return (
    <div>
      {showControls && (
        <div className="layer-bar">
          <select className="input sm" style={{ width: 'auto' }} value={layerId} onChange={(e) => setLayerId(e.target.value)} aria-label="NASA satellite layer">
            {GIBS_LAYERS.map((l) => <option key={l.id} value={l.id}>{l.id === 'none' ? '🗺️ ' : '🛰️ '}{l.label}</option>)}
          </select>
          {layer.layer && <>
            <input className="input sm" style={{ width: 150 }} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} aria-label="Imagery date" />
            <button className="btn sm" type="button" onClick={() => setDate(addDays(date, -365))} title="Same date one year earlier">−1 year</button>
            <label className="mini row" style={{ gap: 4 }}>Opacity <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
          </>}
        </div>
      )}
      <div className={`map ${tall ? 'tall' : ''}`}>
        <MapContainer center={[lat, lon]} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }} worldCopyJump>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Imagery: NASA GIBS' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} />
          {url && <TileLayer key={url} url={url} opacity={opacity} maxNativeZoom={maxNative} maxZoom={18} attribution="NASA EOSDIS GIBS" />}
          <Rectangle bounds={[[cell.south, cell.west], [cell.north, cell.east]]} pathOptions={{ color: '#1d5fbf', weight: 1.5, dashArray: '5 4', fillOpacity: 0.04 }} />
          <CircleMarker center={[lat, lon]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1f7a4d', fillOpacity: 1 }} />
          <Recenter lat={lat} lon={lon} />
          <Picker onPick={onPick} />
        </MapContainer>
      </div>
      <div className="legend" style={{ marginTop: 6 }}>
        <span><i style={{ background: '#1f7a4d', borderRadius: '50%' }} />Your field</span>
        <span><i style={{ border: '1.5px dashed #1d5fbf', background: 'transparent' }} />NASA POWER grid cell (~0.5° × 0.625°) — weather is regional, not field-level</span>
        {layer.legend && <span>🛰️ {layer.legend} · {date}</span>}
      </div>
    </div>
  );
}
