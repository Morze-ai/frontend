import { type ReactNode } from "react";

import {
  AlertTriangle,
  Clock,
  Info,
  TrendingUp,
  BarChart2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

import type { DashboardPayload, Station } from "../lib/dashboard-types";
import { EVENT_CFG, RISK, type Tab } from "../lib/dashboard-ui";
import { formatDate, sliderLabel } from "../lib/format";

type InspectorPanelProps = {
  isOpen: boolean;
  selectedStation: Station;
  currentPoint: DashboardPayload["waterSeries"][string][number] | undefined;
  chartSeries: Array<{
    timestamp: string;
    water_level_cm: number;
    safe_level_cm: number;
    excess_level_cm: number;
    label: string;
  }>;
  historicalEpisodes: NonNullable<
    DashboardPayload["historicalEpisodes"][string]
  >;
  similarEpisodes: NonNullable<DashboardPayload["similarEpisodes"][string]>;
  seasonalStats: NonNullable<DashboardPayload["seasonalStats"][string]>;
  monthlyStats: NonNullable<DashboardPayload["monthlyStats"][string]>;
  monthsPl: string[];
  timeValue: number;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onClose: () => void;
  onOpen: () => void;
  mobileMode?: boolean;
};

export function InspectorPanel({
  isOpen,
  selectedStation,
  currentPoint,
  chartSeries,
  historicalEpisodes,
  similarEpisodes,
  seasonalStats,
  monthlyStats,
  monthsPl,
  timeValue,
  tab,
  onTabChange,
  onClose,
  onOpen,
  mobileMode = false,
}: InspectorPanelProps) {
  const SHAP_LABELS: Record<string, string> = {
    water_level_cm: "Poziom wody (cm)",
    water_level_m: "Poziom wody (m)",
    water_level: "Poziom wody",
    water_level_lag_1: "Poziom wody -1h",
    water_level_lag_2: "Poziom wody -2h",
    water_level_lag_3: "Poziom wody -3h",
    water_level_lag_6: "Poziom wody -6h",
    water_level_lag_12: "Poziom wody -12h",
    water_level_lag_24: "Poziom wody -24h",
    water_level_lag_48: "Poziom wody -48h",

    // Opady
    rainfall_mm: "Opady (mm)",
    rain_1h_mm: "Opady 1h (mm)",
    rain_3h_mm: "Opady 3h (mm)",
    rain_6h_mm: "Opady 6h (mm)",
    rain_12h_mm: "Opady 12h (mm)",
    rain_24h_mm: "Opady 24h (mm)",
    rain_48h_mm: "Opady 48h (mm)",
    rain_72h_mm: "Opady 72h (mm)",

    temperature_c: "Temperatura (°C)",
    temperature: "Temperatura",

    pressure_hpa: "Ciśnienie (hPa)",
    pressure: "Ciśnienie",
    pressure_hpa_min_3h: "Ciśnienie min. 3h (hPa)",
    pressure_hpa_max_3h: "Ciśnienie maks. 3h (hPa)",
    pressure_hpa_mean_3h: "Ciśnienie śr. 3h (hPa)",
    pressure_hpa_min_6h: "Ciśnienie min. 6h (hPa)",
    pressure_hpa_max_6h: "Ciśnienie maks. 6h (hPa)",
    pressure_hpa_min_12h: "Ciśnienie min. 12h (hPa)",
    pressure_hpa_max_12h: "Ciśnienie maks. 12h (hPa)",
    pressure_hpa_min_24h: "Ciśnienie min. 24h (hPa)",
    pressure_hpa_max_24h: "Ciśnienie maks. 24h (hPa)",

    wind_speed: "Prędkość wiatru",
    wind_direction: "Kierunek wiatru",
    wind_u: "Wiatr",
    wind_v: "Wiatr",

    hour: "Godzina",
    hour_of_day_sin: "Godzina",
    hour_of_day_cos: "Godzina",
    day_of_week: "Dzień tygodnia",
    day_of_week_sin: "Dzień tygodnia",
    day_of_week_cos: "Dzień tygodnia",
    day_of_year: "Dzień roku",
    day_of_year_sin: "Dzień roku",
    day_of_year_cos: "Dzień roku",
    month: "Miesiąc",
    month_sin: "Miesiąc",
    month_cos: "Miesiąc",

    season: "Pora roku",
    season_code: "Pora roku",
    is_growing_season: "Sezon wegetacyjny",
    growing_season: "Sezon wegetacyjny",

    is_weekend: "Weekend",
    weekend: "Weekend",

    humidity: "Wilgotność",
    evapotranspiration: "Ewapotranspiracja",
    snowmelt: "Roztopy śniegu",
    soil_moisture: "Wilgotność gleby",
    alarm_limit: "Próg alarmowy",
    alarm_level: "Poziom alarmowy",
    upstream_level: "Poziom w górę rzeki",
    downstream_level: "Poziom w dół rzeki",
    trend: "Trend",
    rolling_mean_3h: "Średnia krocząca 3h",
    rolling_mean_6h: "Średnia krocząca 6h",
    rolling_mean_12h: "Średnia krocząca 12h",
    rolling_mean_24h: "Średnia krocząca 24h",
    rolling_std_3h: "Odch. std. 3h",
    rolling_std_6h: "Odch. std. 6h",
    rolling_std_24h: "Odch. std. 24h",
  };

  const translateShapName = (name: string): string =>
    SHAP_LABELS[name] ??
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const risk = RISK[selectedStation.riskLevel];

  const seasonOrder = ["wiosna", "lato", "jesień", "zima"] as const;
  const seasonLabels: Record<(typeof seasonOrder)[number], string> = {
    wiosna: "Wiosna",
    lato: "Lato",
    jesień: "Jesień",
    zima: "Zima",
  };
  const sortedSeasonalStats = [...seasonalStats].sort(
    (left, right) =>
      seasonOrder.indexOf(
        left.season.toLowerCase() as (typeof seasonOrder)[number],
      ) -
      seasonOrder.indexOf(
        right.season.toLowerCase() as (typeof seasonOrder)[number],
      ),
  );

  const dominantFactor = selectedStation.dominantFactor ?? {
    event_type: "unknown",
    message: "Brak danych o dominującym czynniku",
    confidence: 0,
    metadata: {
      value: "-",
      threshold: "-",
    },
  };

  const dominantEvent = EVENT_CFG[dominantFactor.event_type] ?? {
    icon: <Info size={20} />,
    color: "text-slate-300",
    bg: "bg-slate-700/60",
    label: dominantFactor.event_type,
  };

  const chartStart = chartSeries[0]?.timestamp;
  const chartEnd = chartSeries[chartSeries.length - 1]?.timestamp;

  // In mobile mode: render only content, skip to normal rendering below.
  // The section/header/tabs wrapper is handled externally by the mobile drawer in App.tsx.
  // We use a flag to skip the outer wrapper rendering.

  if (!isOpen && !mobileMode) {
    return (
      <button
        onClick={onOpen}
        className="absolute top-4 right-4 z-20 rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-2 text-sm font-medium text-slate-300 shadow-xl hover:border-slate-600 hover:text-slate-100"
      >
        <Info size={14} className="inline-block mr-2" />{" "}
        {selectedStation.short_name}
      </button>
    );
  }

  // Content shared between mobile and desktop
  const contentArea = (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 sidebar-scroll">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                {
                  label: "Aktualny",
                  value:
                    currentPoint?.water_level_cm != null
                      ? parseFloat(currentPoint.water_level_cm.toFixed(2))
                      : selectedStation.waterLevel.current,
                  color: "text-white",
                },
                {
                  label: "Predykcja +48h",
                  value: selectedStation.waterLevel.predicted,
                  color: "",
                  style: { color: risk.color },
                },
                {
                  label: "Próg alarmowy",
                  value: selectedStation.waterLevel.alarmLimit,
                  color: "text-red-400",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                >
                  <p className="text-slate-500">{metric.label}</p>
                  <p
                    className={`mt-1 font-mono text-lg font-bold ${metric.color}`}
                    style={metric.style}
                  >
                    {metric.value}{" "}
                    <span className="text-xs text-slate-500">cm</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  Poziom wody
                </p>
                <p className="text-[10px] text-slate-400">
                  {sliderLabel(timeValue)}
                </p>
              </div>
              {chartStart && chartEnd && (
                <p className="mb-2 text-[11px] text-slate-500 font-mono">
                  {formatDate(chartStart)} – {formatDate(chartEnd)}
                </p>
              )}
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartSeries}
                    margin={{ top: 0, right: 0, left: -0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`grad-safe-${selectedStation.id}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="10%"
                          stopColor="#22c55e"
                          stopOpacity={0.5}
                        />
                        <stop
                          offset="95%"
                          stopColor="#22c55e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="grad-excess"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ef4444"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="100%"
                          stopColor="#ef4444"
                          stopOpacity={0.12}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1e293b"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#475569"
                      fontSize={10}
                      interval="preserveStartEnd"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={18}
                    />
                    <YAxis stroke="#475569" fontSize={10} width={32} />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <ReferenceLine
                      y={selectedStation.waterLevel.alarmLimit}
                      stroke="#f87171"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={selectedStation.waterLevel.predicted}
                      stroke="#38bdf8"
                      strokeDasharray="3 3"
                    />
                    <Area
                      type="monotone"
                      dataKey="safe_level_cm"
                      name="Poziom bezpieczny"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill={`url(#grad-safe-${selectedStation.id})`}
                      stackId="water"
                    />
                    <Area
                      type="monotone"
                      dataKey="excess_level_cm"
                      name="Przekroczenie progu"
                      stroke="#f87171"
                      strokeWidth={2}
                      fill="url(#grad-excess)"
                      stackId="water"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-full shrink-0 ${dominantEvent.bg}`}
                >
                  <span className={dominantEvent.color}>
                    {dominantEvent.icon}
                  </span>
                </div>
                <div>
                  <p
                    className={`text-xs font-bold uppercase tracking-wider ${dominantEvent.color}`}
                  >
                    {dominantEvent.label}
                  </p>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    {dominantFactor.message}
                  </p>{" "}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] text-slate-300">
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Pewność</p>
                      <p className="font-semibold text-white">
                        {Math.round((dominantFactor?.confidence ?? 0) * 100)}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Wartość</p>
                      <p className="font-semibold text-white">
                        {dominantFactor.metadata?.value ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Próg</p>
                      <p className="font-semibold text-white">
                        {dominantFactor.metadata?.threshold ?? "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                SHAP / wpływ cech
              </p>
              <div className="space-y-2">
                {selectedStation.shapFeatures.map((feature) => (
                  <div
                    key={feature.name}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="w-28 shrink-0 text-slate-300">
                      {translateShapName(feature.name)}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${feature.importance * 100}%`,
                          backgroundColor: risk.color,
                          opacity: 0.75,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-slate-400">
                      {Math.round(feature.importance * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {historicalEpisodes.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                Brak epizodów historycznych dla tej stacji.
              </div>
            ) : (
              historicalEpisodes.map((episode, index) => (
                <div
                  key={`${episode.start}-${index}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">
                      Epizod #{index + 1}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {episode.duration_hours} h
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Start</p>
                      <p className="font-mono text-white">
                        {formatDate(episode.start)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Szczyt</p>
                      <p className="font-mono text-white">
                        {episode.peak_cm} cm
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Koniec</p>
                      <p className="font-mono text-white">
                        {formatDate(episode.end)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "seasonal" && (
          <div className="space-y-4">
            <div className="h-56 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sortedSeasonalStats.map((season) => ({
                    ...season,
                    label:
                      seasonLabels[
                        season.season.toLowerCase() as (typeof seasonOrder)[number]
                      ] ?? season.season,
                  }))}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis dataKey="label" stroke="#475569" fontSize={10} />
                  <YAxis stroke="#475569" fontSize={10} />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      color: "#e2e8f0",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#ffffff" }}
                    cursor={{ fill: "rgba(45, 53, 88, 0.34)" }}
                  />
                  <Bar dataKey="mean_cm" radius={[4, 4, 0, 0]}>
                    {sortedSeasonalStats.map((_, index) => (
                      <Cell
                        key={index}
                        fill={
                          ["#73bb40d6", "#f3eb61cf", "#ca8729d9", "#90ddf7c8"][
                            index % 4
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-48 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyStats.map((month) => ({
                    ...month,
                    label: monthsPl[month.month - 1] ?? String(month.month),
                  }))}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis dataKey="label" stroke="#475569" fontSize={10} />
                  <YAxis stroke="#475569" fontSize={10} />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mean_cm"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="max_cm"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === "similar" && (
          <div className="space-y-3">
            {similarEpisodes.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                Brak podobnych epizodów dla tej stacji.
              </div>
            ) : (
              similarEpisodes.map((episode, index) => (
                <div
                  key={`${episode.timestamp}-${index}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">
                      Podobny epizod #{index + 1}
                    </p>
                    <p className="text-[11px] text-cyan-300">
                      {Math.round(episode.similarity_score * 100)}%
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Data</p>
                      <p className="font-mono text-white">
                        {formatDate(episode.timestamp)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Deszcz 72h</p>
                      <p className="font-mono text-white">
                        {episode.rain_72h_mm} mm
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                      <p className="text-slate-500">Poziom</p>
                      <p className="font-mono text-white">
                        {episode.water_level_cm} cm
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
  );

  // In mobile mode: return only the content area (header/tabs handled by App.tsx mobile drawer)
  if (mobileMode) {
    return contentArea;
  }

  return (
    <section className="absolute top-4 right-4 bottom-[108px] z-20 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700/70 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Inspektor stacji
          </p>
          <h2 className="text-xl font-bold text-white leading-tight">
            {selectedStation.name}
          </h2>
          <span
            className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${risk.bg}`}
            style={{ color: risk.color, borderColor: risk.color + "60" }}
          >
            {selectedStation.riskLevel === "Critical" && (
              <AlertTriangle size={10} />
            )}
            {risk.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex border-b border-slate-800 bg-slate-900/60">
        {(
          [
            ["overview", <AlertTriangle size={12} />, "Przegląd"],
            ["history", <Clock size={12} />, "Historia"],
            ["seasonal", <TrendingUp size={12} />, "Sezonowość"],
            ["similar", <BarChart2 size={12} />, "Podobne"],
          ] as [Tab, ReactNode, string][]
        ).map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${tab === id ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {contentArea}
    </section>
  );
}
