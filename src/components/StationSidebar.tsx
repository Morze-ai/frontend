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
    <aside className="absolute top-4 left-4 bottom-4 z-20 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700/70 bg-slate-950/92 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="px-4 py-4 border-b border-slate-800/80">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">
          Stacje
        </p>
        <h2 className="text-lg font-bold text-white">
          Wybierz punkt pomiarowy
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Kliknij stację, aby przełączyć mapę i wykresy.
        </p>
      </div>
      <div className="p-3 space-y-2 overflow-y-auto flex-1">
        {data.stations.map((station) => {
          const stationRisk = RISK[station.riskLevel];
          const isActive = station.id === selectedStationId;
          return (
            <button
              key={station.id}
              onClick={() => onSelectStation(station.id)}
              className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${isActive ? "border-cyan-500/50 bg-cyan-500/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/70"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">
                    {station.short_name}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {station.description}
                  </p>
                </div>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border"
                  style={{
                    color: stationRisk.color,
                    borderColor: stationRisk.color + "55",
                  }}
                >
                  {station.riskLevel}
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
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
        <p className="text-[11px] text-slate-500 uppercase tracking-[0.24em]">
          Aktualne warunki pogodowe
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
            <p className="text-slate-500">Opad z ostatnich 24h</p>
            <p className="mt-1 text-[10px] text-slate-600">dla całej mapy</p>
            <p className="font-mono font-semibold text-white">
              {weatherNow.rainfall_24h_mm.toFixed(1)} mm
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
            <p className="text-slate-500">Temperatura powietrza</p>
            <p className="mt-1 text-[10px] text-slate-600">aktualny odczyt</p>
            <p className="font-mono font-semibold text-white">
              {weatherNow.temperature_c.toFixed(1)}°C
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
            <p className="text-slate-500">Ciśnienie powietrza</p>
            <p className="mt-1 text-[10px] text-slate-600">aktualny odczyt</p>
            <p className="font-mono font-semibold text-white">
              {Math.round(weatherNow.pressure_hpa)} hPa
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleWeather}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${showWeather ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300" : "bg-slate-900 border-slate-700 text-slate-400"}`}
          >
            Warstwa opadów
          </button>
          <button
            onClick={onToggleReports}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${showReports ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-slate-900 border-slate-700 text-slate-400"}`}
          >
            Raporty PDF
          </button>
        </div>
      </div>
    </aside>
  );
}
