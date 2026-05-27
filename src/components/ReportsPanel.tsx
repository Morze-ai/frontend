import { FileText } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Cell,
} from "recharts";

import type { DashboardPayload } from "../lib/dashboard-types";

type ReportsPanelProps = {
  data: DashboardPayload;
  onClose: () => void;
};

const MODEL_CONFIG: Record<string, { name: string; type: string }> = {
  Linear: { name: "Linear classifier", type: "klasyfikator liniowy" },
  Logistic: {
    name: "Logistic regression classifier",
    type: "klasyfikator liniowy",
  },
  MLP: {
    name: "Multi-layer Perceptron classifier",
    type: "klasyfikator nieliniowy",
  },
};

export function ReportsPanel({ data, onClose }: ReportsPanelProps) {
  const sortedReports = [...data.modelReports].sort(
    (a, b) => b.accuracy - a.accuracy,
  );

  return (
    <section className="w-full h-full rounded-2xl border border-slate-700/70 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h3 className="font-bold text-white flex items-center gap-3 text-base">
          <FileText size={18} className="text-amber-400 shrink-0" /> Raporty
          modeli
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 shrink-0 text-2xl"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 sidebar-scroll">
        <div className="h-28 md:h-32 bg-slate-900/60 rounded-xl p-4 border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedReports.map((report) => ({
                name: report.model_name
                  .replace("_classifier", "")
                  .replace("_regression", ""),
                accuracy: +(report.accuracy * 100).toFixed(1),
              }))}
              margin={{ top: 2, right: 2, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis dataKey="name" stroke="#475569" fontSize={9} />
              <YAxis stroke="#475569" fontSize={8} domain={[50, 100]} />
              <RTooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                itemStyle={{ color: "#e2e8f0" }}
                labelStyle={{ color: "#ffffff" }}
                formatter={(value: any) => [`${Number(value)}%`, "Dokładność"]}
                cursor={{ fill: "rgba(45, 53, 88, 0.34)" }}
              />
              <Bar
                dataKey="accuracy"
                radius={[3, 3, 0, 0]}
                label={{
                  position: "top",
                  fontSize: 8,
                  fill: "#94a3b8",
                  formatter: (value: any) => `${Number(value)}%`,
                }}
              >
                {sortedReports.map((_, index) => (
                  <Cell
                    key={index}
                    fill={["#22d3ee", "#3b82f6", "#8b5cf6"][index % 3]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {sortedReports.map((report, index) => {
          const simpleName = report.model_name
            .replace("_classifier", "")
            .replace("_regression", "");
          const modelConfig = MODEL_CONFIG[simpleName] ?? {
            name: simpleName,
            type: report.experiment_name,
          };
          const pdfUrl =
            report.pdf_url ??
            (data.reportPdf.modelId === report.model_id
              ? data.reportPdf.url
              : null);
          return (
            <article
              key={report.model_id}
              className={`rounded-xl border p-4 ${index === 0 ? "border-cyan-500/40 bg-cyan-500/5" : "border-slate-700/60 bg-slate-900/60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {modelConfig.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    {modelConfig.type}
                  </p>
                </div>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full border border-cyan-500/40 text-cyan-300 hover:border-cyan-400/60 hover:bg-cyan-500/10 whitespace-nowrap shrink-0 bg-cyan-500/10"
                  >
                    📄 PDF
                  </a>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mt-4 text-slate-300">
                <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800">
                  <p className="text-slate-400 text-xs font-semibold">Dokładność</p>
                  <p className="font-bold text-white text-base mt-1">
                    {(report.accuracy * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800">
                  <p className="text-slate-400 text-xs font-semibold">Epoki</p>
                  <p className="font-bold text-white text-base mt-1">
                    {report.epochs}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800">
                  <p className="text-slate-400 text-xs font-semibold">Wiersze testu</p>
                  <p className="font-bold text-white text-base mt-1">
                    {report.test_rows}
                  </p>
                </div>
              </div>
              {report.report_summary && (
                <p className="text-xs text-slate-400 mt-2 md:mt-3 leading-relaxed">
                  {report.report_summary}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
