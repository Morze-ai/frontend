import { useEffect } from 'react';
import L from 'leaflet';
import {
  CircleMarker, MapContainer, TileLayer, Tooltip as LeafletTooltip, useMap,
} from 'react-leaflet';

import type { Station } from '../lib/dashboard-types';
import { RISK } from '../lib/dashboard-ui';

type MapPanelProps = {
  stations: Station[];
  selectedStation: Station;
  weatherRainMm: number;
  showWeather: boolean;
  onSelectStation: (stationId: string) => void;
  onOpenInspector: () => void;
};

function MapFocus({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom() || 10, { animate: true });
  }, [center, map]);

  return null;
}

function MapControls() {
  const map = useMap();

  useEffect(() => {
    const zoomControl = L.control.zoom({ position: 'bottomright' });

    zoomControl.addTo(map);

    zoomControl.getContainer()?.classList.add('leaflet-zoom-horizontal');

    return () => {
      zoomControl.remove();
    };
  }, [map]);

  return null;
}

function WeatherOverlay({
  center,
  rainfallMm,
  show,
}: {
  center: [number, number];
  rainfallMm: number;
  show: boolean;
}) {
  if (!show || rainfallMm <= 0) return null;

  const intensity = Math.min(1, rainfallMm / 8);
  const circles: Array<[number, number, number, number]> = [
    [0, 0, 1, 20],
    [0.012, -0.015, 0.7, 16],
    [-0.01, 0.014, 0.65, 15],
    [0.018, 0.01, 0.45, 12],
    [-0.016, -0.012, 0.5, 13],
  ];

  return (
    <>
      {circles.map(([latOffset, lngOffset, weight, radius], index) => {
        const centerPoint: [number, number] = [center[0] + latOffset, center[1] + lngOffset];
        const localRainfall = rainfallMm * weight;
        return (
          <CircleMarker
            key={index}
            center={centerPoint}
            radius={radius + intensity * 18 * weight}
            pathOptions={{
              color: '#38bdf8',
              weight: 1,
              opacity: 0.6,
              fillColor: '#38bdf8',
              fillOpacity: 0.12 + intensity * 0.18 * weight,
            }}
          >
            <LeafletTooltip direction="top" offset={[0, -2]} opacity={0.95}>
              Intensywność opadu: {localRainfall.toFixed(1)} mm
            </LeafletTooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

export function MapPanel({
  stations,
  selectedStation,
  weatherRainMm,
  showWeather,
  onSelectStation,
  onOpenInspector,
}: MapPanelProps) {
  return (
    <div className="absolute inset-0 z-0">
      <MapContainer center={selectedStation.coords} zoom={10} className="absolute inset-0" zoomControl={false} scrollWheelZoom>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />
        <MapFocus center={selectedStation.coords} />
        <MapControls />
        <WeatherOverlay center={selectedStation.coords} rainfallMm={weatherRainMm} show={showWeather} />

        {stations.map((station) => {
          const stationRisk = RISK[station.riskLevel];
          const isActive = station.id === selectedStation.id;
          return (
            <CircleMarker
              key={station.id}
              center={station.coords}
              radius={isActive ? stationRisk.radius + 2 : stationRisk.radius}
              pathOptions={{
                color: stationRisk.color,
                fillColor: stationRisk.color,
                fillOpacity: isActive ? 0.95 : 0.75,
                opacity: 1,
                weight: isActive ? 2 : 1,
              }}
              eventHandlers={{ click: () => { onSelectStation(station.id); onOpenInspector(); } }}
            >
              <LeafletTooltip direction="top" offset={[0, -4]} opacity={0.95}>
                <div className="text-xs">
                  <div className="font-semibold">{station.short_name}</div>
                  <div>{station.riskLevel}</div>
                </div>
              </LeafletTooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.04)_0%,rgba(2,6,23,0.22)_60%,rgba(2,6,23,0.58)_100%)]" />
    </div>
  );
}
