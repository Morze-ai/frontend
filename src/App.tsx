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
import { type Tab, RISK } from "./lib/dashboard-ui";

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
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [timeValue, setTimeValue] = useState(0);
  const [showWeather, setShowWeather] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadData = (isRetry = false) => {
    if (isRetry) setLoading(true);
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
        setRetryCount(0);
        setRetryCountdown(0);
      })
      .catch((caughtError) => {
        if (!alive) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać danych z backendu.",
        );
        setRetryCount((c) => c + 1);
        // Auto-retry countdown: 30s
        setRetryCountdown(30);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  };

  useEffect(() => {
    return loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-retry countdown timer
  useEffect(() => {
    if (retryCountdown <= 0) return;
    if (retryCountdown === 1) {
      // Fire retry when countdown hits 0
      const t = setTimeout(() => loadData(true), 1000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRetryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCountdown]);

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
    const RETRY_TOTAL = 30;
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6 text-center">
          {/* Animated icon */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle size={32} className="text-red-400" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black text-white mb-2">Backend niedostępny</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Serwer zwrócił błąd. Dane nie mogły zostać załadowane.<br />
              Aplikacja spróbuje połączyć się automatycznie.
            </p>
          </div>

          {/* Error detail */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-left">
            <p className="text-[11px] uppercase tracking-wider text-red-400/70 mb-1">Szczegóły błędu</p>
            <p className="text-xs text-slate-300 font-mono break-all">{error}</p>
          </div>

          {/* Countdown + progress bar */}
          {retryCountdown > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                Następna próba za{" "}
                <span className="text-cyan-300 font-bold tabular-nums">{retryCountdown}s</span>
                {retryCount > 1 && (
                  <span className="text-slate-500"> · próba #{retryCount + 1}</span>
                )}
              </p>
              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-1000"
                  style={{ width: `${((RETRY_TOTAL - retryCountdown) / RETRY_TOTAL) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Manual retry */}
          <button
            onClick={() => { setRetryCountdown(0); loadData(true); }}
            className="w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all"
          >
            ↻ Spróbuj teraz
          </button>
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

      <div className="relative flex-1 overflow-hidden">
        <MapPanel
          stations={data.stations}
          selectedStation={selectedStation}
          weatherRainMm={data.currentWeather.rainfall_mm}
          showWeather={showWeather}
          onSelectStation={(stationId) => {
            setSelectedStationId(stationId);
            setInspectorOpen(true);
          }}
          onOpenInspector={() => setInspectorOpen(true)}
        />

        {/* Desktop Sidebar - Hidden on mobile */}
        <div className="hidden lg:block">
          <StationSidebar
            data={data}
            selectedStationId={selectedStation.id}
            weatherNow={data.currentWeather}
            showWeather={showWeather}
            showReports={showReports}
            onSelectStation={(stationId) => {
              setSelectedStationId(stationId);
              setInspectorOpen(true);
            }}
            onToggleWeather={() => setShowWeather((visible) => !visible)}
            onToggleReports={() => setShowReports((visible) => !visible)}
          />
        </div>



        {/* Desktop Inspector - Hidden on mobile */}
        <div className="hidden lg:block">
          <InspectorPanel
            isOpen={inspectorOpen}
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

        {/* Desktop Timeline - Hidden on mobile */}
        <div className="hidden lg:block">
          <TimelineSlider timeValue={timeValue} onChange={setTimeValue} />
        </div>

        {/* Reports Panel - Desktop only */}
        {showReports && (
          <div className="hidden lg:block absolute right-90 top-0 bottom-20 z-20 w-105">
            <ReportsPanel
              data={data}
              onClose={() => setShowReports(false)}
              className="flex flex-col h-full rounded-2xl border border-slate-700/70 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            />
          </div>
        )}

        {/* Mobile Sidebar Drawer — bottom sheet style */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className="absolute bottom-0 left-0 right-0 bg-slate-950 rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: "88vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-700" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 mb-0.5">Stacje</p>
                  <h2 className="text-lg font-bold text-white">Wybierz punkt pomiarowy</h2>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Station list */}
              <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-3">
                {data.stations.map((station) => {
                  const stationRisk = RISK[station.riskLevel];
                  const isActive = station.id === selectedStation.id;
                  return (
                    <button
                      key={station.id}
                      onClick={() => {
                        setSelectedStationId(station.id);
                        setSidebarOpen(false);
                        setInspectorOpen(true);
                      }}
                      className={`w-full text-left rounded-2xl border px-4 py-4 transition-all active:scale-[0.98] ${
                        isActive
                          ? "border-cyan-500/50 bg-cyan-500/10"
                          : "border-slate-800 bg-slate-900/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-bold text-white text-base">{station.short_name}</p>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{station.description}</p>
                        </div>
                        <span
                          className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 mt-0.5"
                          style={{ color: stationRisk.color, borderColor: stationRisk.color + "55" }}
                        >
                          {stationRisk.label}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (station.waterLevel.current / Math.max(1, station.waterLevel.alarmLimit)) * 100)}%`,
                            backgroundColor: stationRisk.color,
                          }}
                        />
                      </div>
                      <div className="flex gap-4 mt-3 text-[11px]">
                        <span className="text-slate-500">Aktualny: <span className="text-white font-mono font-semibold">{station.waterLevel.current} cm</span></span>
                        <span className="text-slate-500">Próg: <span className="text-red-400 font-mono font-semibold">{station.waterLevel.alarmLimit} cm</span></span>
                      </div>
                    </button>
                  );
                })}

                {/* Weather summary */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 mt-1">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-3">Aktualne warunki pogodowe</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                      <p className="text-slate-500 leading-tight">Opad 24h</p>
                      <p className="font-mono font-bold text-white mt-1">{data.currentWeather.rainfall_24h_mm.toFixed(1)}<span className="text-slate-500 font-normal"> mm</span></p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                      <p className="text-slate-500 leading-tight">Temperatura</p>
                      <p className="font-mono font-bold text-white mt-1">{data.currentWeather.temperature_c.toFixed(1)}<span className="text-slate-500 font-normal">°C</span></p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                      <p className="text-slate-500 leading-tight">Ciśnienie</p>
                      <p className="font-mono font-bold text-white mt-1">{Math.round(data.currentWeather.pressure_hpa)}<span className="text-slate-500 font-normal"> hPa</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safe area spacer */}
              <div className="h-safe-area-inset-bottom" />
            </div>
          </div>
        )}

        {/* Mobile Inspector Drawer — full-screen with tabs */}
        {inspectorOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-slate-950">
            {/* Station header */}
            <div
              className="shrink-0 px-5 pt-5 pb-3 border-b border-slate-800/80"
              style={{ background: "linear-gradient(180deg, #0f1629 0%, #0f172a 100%)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">Inspektor stacji</p>
                  <h2 className="text-xl font-bold text-white leading-tight">{selectedStation.name}</h2>
                  <span
                    className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${RISK[selectedStation.riskLevel].bg}`}
                    style={{ color: RISK[selectedStation.riskLevel].color, borderColor: RISK[selectedStation.riskLevel].color + "60" }}
                  >
                    {selectedStation.riskLevel === "Critical" && "⚠ "}
                    {RISK[selectedStation.riskLevel].label}
                  </span>
                </div>
                <button
                  onClick={() => setInspectorOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { label: "Aktualny", value: `${currentPoint?.water_level_cm != null ? parseFloat(currentPoint.water_level_cm.toFixed(0)) : selectedStation.waterLevel.current} cm`, color: "text-white" },
                  { label: "Predykcja +48h", value: `${selectedStation.waterLevel.predicted} cm`, color: "", style: { color: RISK[selectedStation.riskLevel].color } },
                  { label: "Próg alarmowy", value: `${selectedStation.waterLevel.alarmLimit} cm`, color: "text-red-400" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
                    <p className="text-[10px] text-slate-500">{m.label}</p>
                    <p className={`mt-1 font-mono text-base font-bold ${m.color}`} style={m.style}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab bar */}
            <div className="shrink-0 flex border-b border-slate-800 bg-slate-900/60">
              {([
                ["overview", "📈", "Przegląd"],
                ["history", "🕐", "Historia"],
                ["seasonal", "📅", "Sezony"],
                ["similar", "🔍", "Podobne"],
              ] as [typeof tab, string, string][]).map(([id, icon, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${
                    tab === id
                      ? "border-cyan-500 text-cyan-400"
                      : "border-transparent text-slate-500"
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Scrollable content */}
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
                mobileMode={true}
              />
            </div>

            {/* Timeline at bottom */}
            <div className="shrink-0 bg-slate-950/98 border-t border-slate-800/80 px-4 py-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-2">
                <span className="text-slate-300">-48h</span>
                <span className="text-slate-300">Teraz</span>
                <span className="text-cyan-300">+48h</span>
              </div>
              <div className="relative h-8 flex items-center">
                <div className="absolute inset-x-0 h-2 rounded-full bg-gradient-to-r from-slate-700 via-slate-500 to-cyan-500/60" />
                <div
                  className="absolute w-5 h-5 rounded-full bg-white ring-2 ring-slate-950 shadow-[0_0_12px_rgba(255,255,255,0.9)] pointer-events-none"
                  style={{ left: `${((timeValue - (-48)) / 96) * 100}%`, transform: "translateX(-50%)" }}
                />
                <input
                  type="range"
                  min={-48}
                  max={48}
                  step={3}
                  value={timeValue}
                  onChange={(e) => setTimeValue(Number(e.target.value))}
                  className="timeline-slider w-full absolute inset-0 opacity-0 cursor-pointer z-10"
                />
              </div>
              <p className="text-center text-[11px] text-cyan-300 font-semibold mt-2">
                {timeValue === 0 ? "⚡ Bieżąca godzina" : timeValue > 0 ? `+${timeValue}h od teraz` : `${timeValue}h temu`}
              </p>
            </div>
          </div>
        )}

        {/* Mobile Reports Drawer */}
        {showReports && !sidebarOpen && !inspectorOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-slate-950">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80" style={{ background: "linear-gradient(180deg, #0f1629 0%, #0f172a 100%)" }}>
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 mb-0.5">Modele AI</p>
                <h2 className="text-lg font-bold text-white">Raporty modeli</h2>
              </div>
              <button
                onClick={() => setShowReports(false)}
                className="w-9 h-9 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ReportsPanel data={data} onClose={() => setShowReports(false)} hideHeader={true} />
            </div>
          </div>
        )}

        {/* Mobile Control Buttons */}
        <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80">
          <div className="flex items-stretch h-16">
            {/* Stacje */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-cyan-300 active:bg-slate-800/60 transition-colors"
            >
              <span className="text-lg leading-none">📍</span>
              <span className="text-[10px] font-semibold tracking-wide uppercase">Stacje</span>
            </button>

            {/* Divider */}
            <div className="w-px bg-slate-800/80 self-stretch" />

            {/* Szczegóły */}
            <button
              onClick={() => setInspectorOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-amber-300 active:bg-slate-800/60 transition-colors"
            >
              <span className="text-lg leading-none">📊</span>
              <span className="text-[10px] font-semibold tracking-wide uppercase">Szczegóły</span>
            </button>

            {/* Divider */}
            <div className="w-px bg-slate-800/80 self-stretch" />

            {/* Raporty */}
            <button
              onClick={() => setShowReports((v) => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:bg-slate-800/60 ${
                showReports ? "text-emerald-300" : "text-slate-400"
              }`}
            >
              <span className="text-lg leading-none">📄</span>
              <span className="text-[10px] font-semibold tracking-wide uppercase">Raporty</span>
            </button>


          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
