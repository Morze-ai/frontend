import "leaflet/dist/leaflet.css";

import "./App.css";
import { loadDashboard, loadShapFeatures } from "./lib/dashboard-api";
import { useEffect, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

import { InspectorPanel } from "./components/InspectorPanel";
import { MapPanel } from "./components/MapPanel";
import { ReportsPanel } from "./components/ReportsPanel";
import { StationSidebar } from "./components/StationSidebar";
import { TimelineSlider } from "./components/TimelineSlider";
import type { DashboardPayload } from "./lib/dashboard-types";
import { type Tab } from "./lib/dashboard-ui";

const FORECAST_STEP_HOURS = 3;
const FORECAST_HORIZON_HOURS = 48;

function formatTimelineTick(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pl-PL", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

function buildForecastSeries(
  series: DashboardPayload["stations"][number]["series"],
  predictedWaterLevel: number,
) {
  if (series.length === 0) return [];

  const lastPoint = series[series.length - 1];
  const lastTimestamp = new Date(lastPoint.timestamp);
  const forecastSteps = FORECAST_HORIZON_HOURS / FORECAST_STEP_HOURS;

  const forecastSeries = Array.from({ length: forecastSteps }, (_, index) => {
    const step = index + 1;
    const timestamp = new Date(
      lastTimestamp.getTime() + step * FORECAST_STEP_HOURS * 3600 * 1000,
    );
    const ratio = step / forecastSteps;

    return {
      timestamp: timestamp.toISOString(),
      water_level_cm:
        lastPoint.water_level_cm +
        (predictedWaterLevel - lastPoint.water_level_cm) * ratio,
      isForecast: true,
    };
  });

  return [...series, ...forecastSeries];
}

function App() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [timeValue, setTimeValue] = useState(0);
  const [showWeather, setShowWeather] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([loadDashboard(), loadShapFeatures("mlp_water_level")])
      .then(([payload, shapFeatures]) => {
        if (!alive) return;

        if (shapFeatures.length > 0) {
          payload.stations = payload.stations.map((station) => ({
            ...station,
            shapFeatures,
          }));
        }

        setData(payload);
        setSelectedStationId(
          (current) =>
            current ??
            payload.selectedStationId ??
            payload.stations[0]?.id ??
            null,
        );
        setError(null);
      })
      .catch((caughtError) => {
        if (!alive) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać danych z backendu.",
        );
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
    if (
      !selectedStationId ||
      !data.stations.some((station) => station.id === selectedStationId)
    ) {
      const newStationId = data.selectedStationId ?? data.stations[0]?.id;
      if (newStationId && newStationId !== selectedStationId) {
        setSelectedStationId(newStationId);
      }
    }
  }, [data, selectedStationId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          <p className="text-sm text-slate-400">
            Ładowanie danych z backendu...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertTriangle size={28} className="mx-auto mb-3 text-red-300" />
          <h1 className="text-xl font-bold mb-2">
            Nie udało się załadować dashboardu
          </h1>
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
          <p className="text-sm text-slate-300">
            Backend zwrócił pusty dashboard.
          </p>
        </div>
      </div>
    );
  }

  const selectedStation =
    data.stations.find((station) => station.id === selectedStationId) ??
    data.stations[0];
  const timelineSeries = buildForecastSeries(
    selectedStation.series,
    selectedStation.waterLevel.predicted,
  );
  const currentSeriesIndex = Math.min(
    timelineSeries.length - 1,
    Math.max(
      0,
      selectedStation.series.length -
        1 +
        Math.round(timeValue / FORECAST_STEP_HOURS),
    ),
  );
  const currentPoint =
    timelineSeries[currentSeriesIndex] ??
    timelineSeries[timelineSeries.length - 1];
  const chartSeries = timelineSeries
    .slice(Math.max(0, currentSeriesIndex - 47), currentSeriesIndex + 1)
    .map((point) => {
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
        <div className="px-4 md:px-6 py-4 md:py-5 flex flex-col gap-2 md:gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <p className="text-[10px] md:text-[11px] uppercase tracking-[0.25em] md:tracking-[0.35em] text-cyan-400">
              Morze AI
            </p>
            <h1 className="text-2xl md:text-2xl lg:text-3xl font-black tracking-tight text-white">
              Panel predykcji poziomów wody
            </h1>
            <p className="text-sm md:text-sm text-slate-400 mt-2 hidden sm:block">
              Stacje • Pogoda • Predykcje • Raporty
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 md:gap-2 text-[11px] md:text-xs text-slate-300">
            <span className="px-2 md:px-3 py-1 md:py-2 rounded-full border border-slate-700 bg-slate-900/80 whitespace-nowrap">
              Stacje: {data.stations.length}
            </span>
            <span className="px-2 md:px-3 py-1 md:py-2 rounded-full border border-slate-700 bg-slate-900/80 whitespace-nowrap">
              Krytyczne:{" "}
              {
                data.stations.filter(
                  (station) => station.riskLevel === "Critical",
                ).length
              }
            </span>
            <span className="px-2 md:px-3 py-1 md:py-2 rounded-full border border-slate-700 bg-slate-900/80 whitespace-nowrap">
              Ostrzeżenia:{" "}
              {
                data.stations.filter(
                  (station) => station.riskLevel === "Warning",
                ).length
              }
            </span>
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden flex flex-col lg:flex-row pb-20 lg:pb-0">
        {/* Sidebar - Hidden on mobile unless opened, visible on desktop */}
        <div className="hidden lg:flex flex-col shrink-0 w-85 border-r border-slate-800/80 bg-slate-950/85 overflow-hidden order-1">
          <StationSidebar
            data={data}
            selectedStationId={selectedStation.id}
            weatherNow={data.currentWeather}
            showWeather={showWeather}
            showReports={showReports}
            onSelectStation={(stationId) => {
              setSelectedStationId(stationId);
            }}
            onToggleWeather={() => setShowWeather((visible) => !visible)}
            onToggleReports={() => setShowReports((visible) => !visible)}
          />
        </div>

        {/* Map - Full width on mobile, flex-1 on desktop */}
        <div className="flex-1 overflow-hidden order-2 lg:order-2">
          <MapPanel
            stations={data.stations}
            selectedStation={selectedStation}
            weatherRainMm={data.currentWeather.rainfall_mm}
            showWeather={showWeather}
            onSelectStation={(stationId) => {
              setSelectedStationId(stationId);
              setInspectorOpen(true);
              setSidebarOpen(false);
            }}
            onOpenInspector={() => setInspectorOpen(true)}
          />
        </div>

        {/* Inspector Panel - Hidden on mobile unless opened, visible on desktop */}
        <div className="hidden lg:flex flex-col shrink-0 w-90 border-l border-slate-800/80 bg-slate-950/85 overflow-hidden order-3">
          <InspectorPanel
            isOpen={true}
            selectedStation={selectedStation}
            currentPoint={currentPoint}
            chartSeries={chartSeries}
            historicalEpisodes={
              data.historicalEpisodes[selectedStation.id] ??
              selectedStation.historicalEpisodes
            }
            similarEpisodes={
              data.similarEpisodes[selectedStation.id] ??
              selectedStation.similarEpisodes
            }
            seasonalStats={
              data.seasonalStats[selectedStation.id] ??
              selectedStation.seasonalStats
            }
            monthlyStats={
              data.monthlyStats[selectedStation.id] ??
              selectedStation.monthlyStats
            }
            monthsPl={data.monthsPl}
            timeValue={timeValue}
            tab={tab}
            onTabChange={setTab}
            onClose={() => setInspectorOpen(false)}
            onOpen={() => setInspectorOpen(true)}
          />
        </div>

        {/* Mobile Sidebar Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex flex-col">
            <div className="flex items-center justify-between bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 px-4 py-4">
              <h2 className="text-lg font-bold text-white">Stacje pomiarowe</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-slate-400 hover:text-slate-100 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <StationSidebar
                data={data}
                selectedStationId={selectedStation.id}
                weatherNow={data.currentWeather}
                showWeather={showWeather}
                showReports={showReports}
                onSelectStation={(stationId) => {
                  setSelectedStationId(stationId);
                  setSidebarOpen(false);
                }}
                onToggleWeather={() => setShowWeather((visible) => !visible)}
                onToggleReports={() => setShowReports((visible) => !visible)}
              />
            </div>
          </div>
        )}

        {/* Mobile Inspector Drawer */}
        {inspectorOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex flex-col">
            <div className="flex items-center justify-between bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 px-4 py-4">
              <h2 className="text-lg font-bold text-white">Szczegóły stacji</h2>
              <button
                onClick={() => setInspectorOpen(false)}
                className="text-slate-400 hover:text-slate-100 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <InspectorPanel
                isOpen={true}
                selectedStation={selectedStation}
                currentPoint={currentPoint}
                chartSeries={chartSeries}
                historicalEpisodes={
                  data.historicalEpisodes[selectedStation.id] ??
                  selectedStation.historicalEpisodes
                }
                similarEpisodes={
                  data.similarEpisodes[selectedStation.id] ??
                  selectedStation.similarEpisodes
                }
                seasonalStats={
                  data.seasonalStats[selectedStation.id] ??
                  selectedStation.seasonalStats
                }
                monthlyStats={
                  data.monthlyStats[selectedStation.id] ??
                  selectedStation.monthlyStats
                }
                monthsPl={data.monthsPl}
                timeValue={timeValue}
                tab={tab}
                onTabChange={setTab}
                onClose={() => setInspectorOpen(false)}
                onOpen={() => setInspectorOpen(true)}
              />
            </div>
          </div>
        )}

        {/* Reports Panel */}
        {showReports && (
          <div className="hidden lg:block absolute right-90 top-0 bottom-20 z-20 w-105">
            <ReportsPanel data={data} onClose={() => setShowReports(false)} />
          </div>
        )}

        {/* Timeline Slider - Always visible at bottom */}
        <TimelineSlider timeValue={timeValue} onChange={setTimeValue} />

        {/* Mobile Control Buttons */}
        <div className="fixed bottom-0 left-0 right-0 z-30 flex gap-3 px-3 py-3 lg:hidden bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 flex-wrap">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 min-w-[90px] bg-cyan-500/20 border border-cyan-500/40 rounded-lg px-3 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/30 active:bg-cyan-500/40 transition-colors"
          >
            📍
            <br />
            <span className="text-xs">Stacje</span>
          </button>
          <button
            onClick={() => setInspectorOpen(true)}
            className="flex-1 min-w-[90px] bg-amber-500/20 border border-amber-500/40 rounded-lg px-3 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 active:bg-amber-500/40 transition-colors"
          >
            📊
            <br />
            <span className="text-xs">Szczegóły</span>
          </button>
          <button
            onClick={() => setShowWeather(!showWeather)}
            className={`flex-1 min-w-[90px] rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${showWeather ? "bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30" : "bg-slate-700/30 border border-slate-700/50 text-slate-400 hover:bg-slate-700/40"}`}
          >
            ☁️
            <br />
            <span className="text-xs">Pogoda</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
