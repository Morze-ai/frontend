import { ExternalLink, FileText, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, Cell,
} from 'recharts';

import type { DashboardPayload } from '../lib/dashboard-types';

type ReportsPanelProps = {
  data: DashboardPayload;
  onClose: () => void;
};

export function ReportsPanel({ data, onClose }: ReportsPanelProps) {
  return (
    <section className="absolute top-4 right-[448px] bottom-[108px] z-20 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700/70 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h3 className="font-bold text-white flex items-center gap-2">
          <FileText size={16} className="text-cyan-400" /> Raporty modeli
        </h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="h-32 bg-slate-900/60 rounded-xl p-3 border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.modelReports.map((report) => ({ name: report.model_name.replace('_classifier', '').replace('_regression', ''), accuracy: +(report.accuracy * 100).toFixed(1) }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#475569" fontSize={10} />
              <YAxis stroke="#475569" fontSize={9} domain={[50, 100]} />
              <RTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} formatter={(value: any) => [`${Number(value)}%`, 'Accuracy']} />
              <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 9, fill: '#94a3b8', formatter: (value: any) => `${Number(value)}%` }}>
                {data.modelReports.map((_, index) => (
                  <Cell key={index} fill={['#22d3ee', '#3b82f6', '#8b5cf6'][index % 3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {data.modelReports.map((report, index) => {
          const pdfUrl = report.pdf_url ?? (data.reportPdf.modelId === report.model_id ? data.reportPdf.url : null);
          return (
            <article key={report.model_id} className={`rounded-xl border p-3 ${index === 0 ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-700/60 bg-slate-900/60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{report.model_name.replace('_classifier', '').replace('_regression', '')}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{report.experiment_name}</p>
                </div>
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-cyan-500/40 text-cyan-300 hover:border-cyan-400/60 hover:bg-cyan-500/10">
                    PDF <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] mt-3 text-slate-300">
                <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                  <p className="text-slate-500">Accuracy</p>
                  <p className="font-semibold text-white">{(report.accuracy * 100).toFixed(1)}%</p>
                </div>
                <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                  <p className="text-slate-500">Epoki</p>
                  <p className="font-semibold text-white">{report.epochs}</p>
                </div>
                <div className="rounded-lg bg-slate-950/70 p-2 border border-slate-800">
                  <p className="text-slate-500">Test</p>
                  <p className="font-semibold text-white">{report.test_rows}</p>
                </div>
              </div>
              {report.report_summary && <p className="text-xs text-slate-400 mt-3 leading-relaxed">{report.report_summary}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
