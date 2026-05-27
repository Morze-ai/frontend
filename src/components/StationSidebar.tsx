import type { DashboardPayload } from "../lib/dashboard-types";
import { RISK } from "../lib/dashboard-ui";

type StationSidebarProps = {
  data: DashboardPayload;
  selectedStationId: string;
  weatherNow: DashboardPayload["currentWeather"];
  showWeather: boolean;
  showReports: boolean;
  onSelectStation: (stationId: string) => void;
  onToggleWeather: () => void;
  onToggleReports: () => void;
};

export function StationSidebar({
  data,
  selectedStationId,
  weatherNow,
  showWeather,
  showReports,
  onSelectStation,
  onToggleWeather,
  onToggleReports,
}: StationSidebarProps) {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-3 md:px-4 py-3 md:py-4 border-b border-slate-800/80">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">
          Stacje
        </p>
        <h2 className="text-base md:text-lg font-bold text-white">
          Wybierz punkt pomiarowy
        </h2>
        <p className="text-xs md:text-sm text-slate-400 mt-1">
          Kliknij stację, aby przełączyć mapę i wykresy.
        </p>
      </div>
      <div className="p-2 md:p-3 space-y-2 md:space-y-3 overflow-y-auto flex-1 sidebar-scroll">
        {data.stations.map((station) => {
          const stationRisk = RISK[station.riskLevel];
          const isActive = station.id === selectedStationId;
          return (
            <button
              key={station.id}
              onClick={() => onSelectStation(station.id)}
              className={`w-full text-left rounded-xl border px-2 md:px-3 py-2 md:py-3 transition-all text-sm md:text-base ${isActive ? "border-cyan-500/50 bg-cyan-500/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/70"}`}
            >
              <div className="flex items-start justify-between gap-2 md:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">
                    {station.short_name}
                  </p>
                  <p className="text-xs md:text-sm text-slate-400 mt-1 truncate">
                    {station.description}
                  </p>
                </div>
                <span
                  className="text-[10px] md:text-[11px] uppercase tracking-wider px-2 py-1 rounded-full border whitespace-nowrap"
                  style={{
                    color: stationRisk.color,
                    borderColor: stationRisk.color + "55",
                  }}
                >
                  {station.riskLevel}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (station.waterLevel.current / Math.max(1, station.waterLevel.alarmLimit)) * 100)}%`,
                    backgroundColor: stationRisk.color,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-slate-800 p-4 space-y-3">
        <p className="text-[12px] text-slate-400 uppercase tracking-[0.24em] font-semibold">
          Warunki pogodowe
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
            <p className="text-slate-400 text-xs">Opad 24h</p>
            <p className="font-mono font-bold text-white text-base mt-1">
              {weatherNow.rainfall_24h_mm.toFixed(1)} mm
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
            <p className="text-slate-400 text-xs">Temperatura</p>
            <p className="font-mono font-bold text-white text-base mt-1">
              {weatherNow.temperature_c.toFixed(1)}°C
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
            <p className="text-slate-400 text-xs">Ciśnienie</p>
            <p className="font-mono font-bold text-white text-base mt-1">
              {Math.round(weatherNow.pressure_hpa)} hPa
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs md:text-sm">
          <button
            onClick={onToggleWeather}
            className={`flex-1 rounded-xl border px-2 md:px-3 py-1.5 md:py-2 font-semibold transition-colors ${showWeather ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300" : "bg-slate-900 border-slate-700 text-slate-400"}`}
          >
            Opady
          </button>
          <button
            onClick={onToggleReports}
            className={`flex-1 rounded-xl border px-2 md:px-3 py-1.5 md:py-2 font-semibold transition-colors ${showReports ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-slate-900 border-slate-700 text-slate-400"}`}
          >
            Raporty
          </button>
        </div>
      </div>
    </div>
  );
}
