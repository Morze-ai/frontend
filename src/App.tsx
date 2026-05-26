import 'leaflet/dist/leaflet.css';

import './App.css';
import { loadDashboard, loadShapFeatures } from './lib/dashboard-api';
import { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

import { InspectorPanel } from './components/InspectorPanel';
import { MapPanel } from './components/MapPanel';
import { ReportsPanel } from './components/ReportsPanel';
import { StationSidebar } from './components/StationSidebar';
import { TimelineSlider } from './components/TimelineSlider';
import type { DashboardPayload } from './lib/dashboard-types';
import { type Tab } from './lib/dashboard-ui';

const FORECAST_STEP_HOURS = 3;
const FORECAST_HORIZON_HOURS = 48;

function formatTimelineTick(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pl-PL', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Warsaw',
  }).format(date);
}

function buildForecastSeries(
  series: DashboardPayload['stations'][number]['series'],
  predictedWaterLevel: number,
) {
  if (series.length === 0) return [];

  const lastPoint = series[series.length - 1];
  const lastTimestamp = new Date(lastPoint.timestamp);
  const forecastSteps = FORECAST_HORIZON_HOURS / FORECAST_STEP_HOURS;

  const forecastSeries = Array.from({ length: forecastSteps }, (_, index) => {
    const step = index + 1;
    const timestamp = new Date(lastTimestamp.getTime() + step * FORECAST_STEP_HOURS * 3600 * 1000);
    const ratio = step / forecastSteps;

    return {
      timestamp: timestamp.toISOString(),
      water_level_cm: lastPoint.water_level_cm + (predictedWaterLevel - lastPoint.water_level_cm) * ratio,
      isForecast: true,
    };
  });

  return [...series, ...forecastSeries];
}

function App() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [timeValue, setTimeValue] = useState(0);
  const [showWeather, setShowWeather] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  useEffect(() => {
    let alive = true;

    Promise.all([
      loadDashboard(),
      loadShapFeatures('mlp_water_level'),
    ])
      .then(([payload, shapFeatures]) => {
        if (!alive) return;
        
        if (shapFeatures.length > 0) {
          payload.stations = payload.stations.map(station => ({
            ...station,
            shapFeatures,
          }));
        }
        
        setData(payload);
        setSelectedStationId((current) => current ?? payload.selectedStationId ?? payload.stations[0]?.id ?? null);
        setError(null);
      })
      .catch((caughtError) => {
        if (!alive) return;
        setError(caughtError instanceof Error ? caughtError.message : 'Nie udało się pobrać danych z backendu.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!data || data.stations.length === 0) return;
    if (!selectedStationId || !data.stations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(data.selectedStationId ?? data.stations[0].id);
    }
  }, [data, selectedStationId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          <p className="text-sm text-slate-400">Ładowanie danych z backendu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertTriangle size={28} className="mx-auto mb-3 text-red-300" />
          <h1 className="text-xl font-bold mb-2">Nie udało się załadować dashboardu</h1>
          <p className="text-sm text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.stations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-slate-700 bg-slate-900/80 p-6 text-center">
          <Info size={28} className="mx-auto mb-3 text-cyan-300" />
          <h1 className="text-xl font-bold mb-2">Brak danych</h1>
          <p className="text-sm text-slate-300">Backend zwrócił pusty dashboard.</p>
        </div>
      </div>
    );
  }

  const selectedStation = data.stations.find((station) => station.id === selectedStationId) ?? data.stations[0];
  const timelineSeries = buildForecastSeries(
    selectedStation.series,
    selectedStation.waterLevel.predicted,
  );
  const currentSeriesIndex = Math.min(
    timelineSeries.length - 1,
    Math.max(0, selectedStation.series.length - 1 + Math.round(timeValue / FORECAST_STEP_HOURS)),
  );
  const currentPoint = timelineSeries[currentSeriesIndex] ?? timelineSeries[timelineSeries.length - 1];
  const chartSeries = timelineSeries.slice(Math.max(0, currentSeriesIndex - 47), currentSeriesIndex + 1).map((point) => {
    const waterLevel = point.water_level_cm;
    const alarmLimit = selectedStation.waterLevel.alarmLimit;

    return {
      ...point,
      label: formatTimelineTick(point.timestamp),
      safe_level_cm: Math.min(waterLevel, alarmLimit),
      excess_level_cm: Math.max(waterLevel - alarmLimit, 0),
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="px-4 md:px-6 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-400">Morze AI</p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Panel predykcji poziomu wody</h1>
            <p className="text-sm text-slate-400 mt-1">Dane pobierane bezpośrednio z backendu: stacje, pogoda, epizody i raporty modeli.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="px-3 py-2 rounded-full border border-slate-700 bg-slate-900/80">Stacje: {data.stations.length}</span>
            <span className="px-3 py-2 rounded-full border border-slate-700 bg-slate-900/80">Krytyczne: {data.stations.filter((station) => station.riskLevel === 'Critical').length}</span>
            <span className="px-3 py-2 rounded-full border border-slate-700 bg-slate-900/80">Ostrzeżenia: {data.stations.filter((station) => station.riskLevel === 'Warning').length}</span>
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <MapPanel
          stations={data.stations}
          selectedStation={selectedStation}
          weatherRainMm={data.currentWeather.rainfall_mm}
          showWeather={showWeather}
          onSelectStation={(stationId) => { setSelectedStationId(stationId); setInspectorOpen(true); }}
          onOpenInspector={() => setInspectorOpen(true)}
        />

        <StationSidebar
          data={data}
          selectedStationId={selectedStation.id}
          weatherNow={data.currentWeather}
          showWeather={showWeather}
          showReports={showReports}
          onSelectStation={(stationId) => { setSelectedStationId(stationId); setInspectorOpen(true); }}
          onToggleWeather={() => setShowWeather((visible) => !visible)}
          onToggleReports={() => setShowReports((visible) => !visible)}
        />

        {showReports && <ReportsPanel data={data} onClose={() => setShowReports(false)} />}

        <InspectorPanel
          isOpen={inspectorOpen}
          selectedStation={selectedStation}
          currentPoint={currentPoint}
          chartSeries={chartSeries}
          historicalEpisodes={data.historicalEpisodes[selectedStation.id] ?? selectedStation.historicalEpisodes}
          similarEpisodes={data.similarEpisodes[selectedStation.id] ?? selectedStation.similarEpisodes}
          seasonalStats={data.seasonalStats[selectedStation.id] ?? selectedStation.seasonalStats}
          monthlyStats={data.monthlyStats[selectedStation.id] ?? selectedStation.monthlyStats}
          monthsPl={data.monthsPl}
          timeValue={timeValue}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setInspectorOpen(false)}
          onOpen={() => setInspectorOpen(true)}
        />

        <TimelineSlider timeValue={timeValue} onChange={setTimeValue} />
      </div>
    </div>
  );
}

export default App;
