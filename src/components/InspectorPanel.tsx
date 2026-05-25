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
}: InspectorPanelProps) {
  const risk = RISK[selectedStation.riskLevel];

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

  if (!isOpen) {
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                {
                  label: "Aktualny",
                  value:
                    currentPoint?.water_level_cm ??
                    selectedStation.waterLevel.current,
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
                    margin={{ top: 10, right: 6, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`grad-${selectedStation.id}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="10%"
                          stopColor={risk.color}
                          stopOpacity={0.5}
                        />
                        <stop
                          offset="95%"
                          stopColor={risk.color}
                          stopOpacity={0}
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
                      dataKey="water_level_cm"
                      stroke={risk.color}
                      strokeWidth={2}
                      fill={`url(#grad-${selectedStation.id})`}
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
                      {feature.name}
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
                  data={seasonalStats}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis dataKey="season" stroke="#475569" fontSize={10} />
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
                    {seasonalStats.map((_, index) => (
                      <Cell
                        key={index}
                        fill={
                          ["#22d3ee", "#3b82f6", "#8b5cf6", "#14b8a6"][
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
    </section>
  );
}
