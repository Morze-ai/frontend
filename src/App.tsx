import { useState, useEffect, useRef } from 'react';
import {
  MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  Activity, AlertTriangle, Info, Wind, Droplets, Snowflake, Leaf,
  FileText, ChevronRight, Clock, TrendingUp, BarChart2, X, CloudRain, Thermometer,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import {
  STATIONS, WATER_SERIES, WEATHER_SERIES, CURRENT_WEATHER,
  HISTORICAL_EPISODES, SIMILAR_EPISODES, SEASONAL_STATS, MONTHLY_STATS,
  MODEL_REPORTS, MONTHS_PL,
  type Station, type RiskLevel,
} from './mock-data';

// ── Constants ────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:8000/api'; // swap mock → real when backend ready
void API_BASE; // silence unused warning

const RISK = {
  Critical: { color: '#ef4444', glow: '0 0 18px #ef4444cc', radius: 14, label: 'KRYTYCZNY', bg: 'bg-red-500/15 border-red-500/40' },
  Warning:  { color: '#f59e0b', glow: '0 0 12px #f59e0baa', radius: 9,  label: 'OSTRZEŻENIE', bg: 'bg-amber-500/15 border-amber-500/40' },
  Safe:     { color: '#22c55e', glow: '0 0 10px #22c55eaa', radius: 7,  label: 'BEZPIECZNY', bg: 'bg-emerald-500/15 border-emerald-500/40' },
};

const EVENT_CFG = {
  long_rainfall:       { icon: <Droplets size={20}/>, color: 'text-blue-400',    bg: 'bg-blue-500/20',    label: 'Nasycenie Zlewni (72h/7d)' },
  flash_flood:         { icon: <Activity size={20}/>, color: 'text-orange-400',  bg: 'bg-orange-500/20',  label: 'Gwałtowna Ulewa' },
  thaw:                { icon: <Snowflake size={20}/>, color: 'text-cyan-300',   bg: 'bg-cyan-500/20',    label: 'Epizod Roztopowy' },
  seasonal_dependency: { icon: <Leaf size={20}/>,     color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Zależność Sezonowa' },
};

type Tab = 'overview' | 'history' | 'seasonal' | 'similar';

// ── Rain/Weather Overlay Component ───────────────────────────────────────────
function WeatherOverlay({ rainfallMm, show }: { rainfallMm: number; show: boolean }) {
  const map = useMap();
  const heatRef = useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    if (!show) {
      if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
      return;
    }
    const intensity = Math.min(1, rainfallMm / 5);
    // Scatter heat points around Gdańsk bay area
    const pts: [number, number, number][] = [
      [54.40, 18.55, intensity * 0.9],
      [54.38, 18.65, intensity * 1.0],
      [54.36, 18.70, intensity * 0.8],
      [54.39, 18.60, intensity * 0.95],
      [54.41, 18.68, intensity * 0.7],
      [54.35, 18.58, intensity * 0.75],
      [54.42, 18.58, intensity * 0.6],
      [54.37, 18.72, intensity * 0.65],
    ];
    if (heatRef.current) map.removeLayer(heatRef.current);
    // @ts-expect-error leaflet.heat not typed
    heatRef.current = L.heatLayer(pts, {
      radius: 80, blur: 50, maxZoom: 12,
      gradient: { 0.2: '#93c5fd', 0.5: '#3b82f6', 0.8: '#1d4ed8', 1.0: '#312e81' },
    });
    heatRef.current.addTo(map);
    return () => { if (heatRef.current) map.removeLayer(heatRef.current); };
  }, [show, rainfallMm, map]);

  return null;
}

// ── Map bounds lock ──────────────────────────────────────────────────────────
function MapBoundsLock() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([53.5, 13.5], [55.2, 20.0]);
    map.setMaxBounds(bounds);
    map.setMinZoom(7);
  }, [map]);
  return null;
}

// ── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: { active?: boolean; payload?: {value:number}[]; label?: string }) {
  if (active && payload?.length) return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="text-white font-mono font-bold">{payload[0].value} cm</p>
    </div>
  );
  return null;
}

// ── Timeline slider step to date offset ─────────────────────────────────────
function sliderLabel(v: number) {
  if (v === 0) return '▶ Bieżąca godzina';
  if (v < 0)  return `↩ ${Math.abs(v)}h temu`;
  return `↦ Prognoza za ${v}h`;
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedStation, setSelectedStation] = useState<Station>(STATIONS[0]);
  const [tab, setTab] = useState<Tab>('overview');
  const [timeValue, setTimeValue] = useState(0);
  const [showWeather, setShowWeather] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const s = selectedStation;
  const risk = RISK[s.riskLevel];
  const ef = EVENT_CFG[s.dominantFactor.event_type];
  const waterSeries = WATER_SERIES[s.id] ?? [];
  const weatherNow = CURRENT_WEATHER;

  // Trim water series based on timeline slider
  const sliderIdx = Math.round((timeValue + 72) / 3);
  const visibleSeries = waterSeries.slice(0, Math.max(4, sliderIdx + 1));
  const currentPoint = waterSeries[sliderIdx] ?? waterSeries[waterSeries.length - 1];

  // Weather chart — only history portion
  const weatherVisible = WEATHER_SERIES.filter(w => {
    const h = (new Date(w.timestamp).getTime() - new Date('2025-05-25T12:00:00').getTime()) / 3600000;
    return h <= timeValue;
  });

  const selectStation = (st: Station) => {
    setSelectedStation(st);
    setInspectorOpen(true);
    setTab('overview');
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ══ LEWY SIDEBAR ══════════════════════════════════════════════════ */}
      <aside className="w-72 shrink-0 bg-slate-900/95 border-r border-slate-800 flex flex-col z-10 shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-lg font-bold tracking-widest text-cyan-400 flex items-center gap-2 uppercase">
            <Activity size={20}/> Port Canals
          </h1>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">
            System Monitoringu Wezbrań Wody
          </p>
        </div>

        {/* Alert count */}
        <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <AlertTriangle size={14} className="text-red-400 shrink-0"/>
          <div>
            <p className="text-xs font-bold text-red-400">
              {STATIONS.filter(st => st.riskLevel === 'Critical').length} aktywne alerty krytyczne
            </p>
            <p className="text-[10px] text-slate-500">
              {STATIONS.filter(st => st.riskLevel === 'Warning').length} ostrzeżenie
            </p>
          </div>
        </div>

        {/* Weather strip */}
        <div className="mx-4 mt-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-blue-300">
            <CloudRain size={13}/>
            <span className="font-mono">{weatherNow.rainfall_mm} mm/h</span>
          </div>
          <div className="flex items-center gap-2 text-orange-300">
            <Thermometer size={13}/>
            <span className="font-mono">{weatherNow.temperature_c}°C</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Wind size={13}/>
            <span className="font-mono">{weatherNow.pressure_hpa} hPa</span>
          </div>
        </div>

        {/* Station list */}
        <p className="text-[10px] text-slate-500 uppercase tracking-widest px-4 pt-4 pb-2 font-semibold">
          Monitorowane Kanały
        </p>
        <div className="flex-1 px-4 pb-3 flex flex-col gap-2 overflow-y-auto">
          {STATIONS.map(st => {
            const r = RISK[st.riskLevel as RiskLevel];
            const active = selectedStation.id === st.id;
            return (
              <button key={st.id} onClick={() => selectStation(st)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all duration-150 ${
                  active ? 'bg-slate-800 border-cyan-500/60' : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                }`}>
                <div>
                  <p className="font-medium text-sm text-slate-100">{st.short_name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    {st.waterLevel.current} cm → pred. {st.waterLevel.predicted} cm
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {st.riskLevel === 'Critical' && <AlertTriangle size={12} className="text-red-400"/>}
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color, boxShadow: r.glow }}/>
                </div>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          <button onClick={() => setShowWeather(v => !v)}
            className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-all ${
              showWeather ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
            <CloudRain size={13}/> Warstwa pogodowa (opad)
          </button>
          <button onClick={() => setShowReports(v => !v)}
            className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg border bg-slate-800 border-slate-700 text-slate-300 hover:border-cyan-500/50 transition-all">
            <FileText size={13}/> Panel Raportów Modeli
            <ChevronRight size={12} className="ml-auto"/>
          </button>
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-slate-800 space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Legenda ryzyka</p>
          {(['Critical', 'Warning', 'Safe'] as RiskLevel[]).map(r => (
            <div key={r} className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK[r].color }}/>
              {RISK[r].label}
            </div>
          ))}
        </div>
      </aside>

      {/* ══ MAPA ═════════════════════════════════════════════════════════ */}
      <div className="flex-1 relative">
        <MapContainer
          center={[54.15, 18.3]}
          zoom={11}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <MapBoundsLock/>
          <WeatherOverlay rainfallMm={weatherNow.rainfall_mm} show={showWeather}/>

          {STATIONS.map(st => {
            const r = RISK[st.riskLevel as RiskLevel];
            return (
              <CircleMarker key={st.id} center={st.coords} radius={r.radius}
                pathOptions={{ color: r.color, fillColor: r.color, fillOpacity: st.riskLevel === 'Critical' ? 0.9 : 0.7, weight: st.riskLevel === 'Critical' ? 3 : 1.5 }}
                eventHandlers={{ click: () => selectStation(st) }}>
                <LeafletTooltip direction="top" offset={[0, -12]} opacity={1}>
                  <strong>{st.name}</strong> · {r.label}
                </LeafletTooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* ══ INSPECTOR PANEL ═══════════════════════════════════════════ */}
        {inspectorOpen && (
          <div className="absolute top-4 left-4 bottom-[108px] w-[440px] flex flex-col bg-slate-900/97 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-[1000] overflow-hidden">

            {/* Inspector header */}
            <div className="flex items-start justify-between p-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">{s.name}</h2>
                <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${risk.bg}`}
                  style={{ color: risk.color, borderColor: risk.color + '60' }}>
                  {s.riskLevel === 'Critical' && <AlertTriangle size={10}/>}
                  {risk.label}
                </span>
              </div>
              <button onClick={() => setInspectorOpen(false)} className="text-slate-500 hover:text-white text-lg mt-0.5">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 shrink-0">
              {([
                ['overview',  <Info size={12}/>,       'Przegląd'],
                ['history',   <Clock size={12}/>,      'Historia'],
                ['seasonal',  <TrendingUp size={12}/>, 'Sezonowość'],
                ['similar',   <BarChart2 size={12}/>,  'Podobne'],
              ] as [Tab, JSX.Element, string][]).map(([id, icon, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                    tab === id ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}>
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* ── TAB: OVERVIEW ── */}
              {tab === 'overview' && (<>
                {/* Water level cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Aktualny', val: currentPoint?.water_level_cm ?? s.waterLevel.current, color: 'text-white' },
                    { label: 'Predykcja +48h', val: s.waterLevel.predicted, color: '', style: { color: risk.color } },
                    { label: 'Próg alarmowy', val: s.waterLevel.alarmLimit, color: 'text-red-400' },
                  ].map(({ label, val, color, style }) => (
                    <div key={label} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                      <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                      <p className={`text-xl font-mono font-bold ${color}`} style={style}>
                        {val}<span className="text-xs text-slate-500 ml-0.5">cm</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Activity size={11}/> Trend Wezbrania Wody
                  </p>
                  <div className="h-40 bg-slate-800/30 rounded-lg p-2 border border-slate-700/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={visibleSeries} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor={risk.color} stopOpacity={0.5}/>
                            <stop offset="95%" stopColor={risk.color} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                        <XAxis dataKey="timestamp" stroke="#475569" fontSize={8} tickFormatter={v => {
                          const h = Math.round((new Date(v).getTime() - new Date('2025-05-25T12:00:00').getTime()) / 3600000);
                          return h === 0 ? 'Teraz' : h > 0 ? `+${h}h` : `${h}h`;
                        }} minTickGap={20}/>
                        <YAxis stroke="#475569" fontSize={9} domain={['dataMin - 10', 'dataMax + 20']}/>
                        <RTooltip content={<ChartTip/>}/>
                        <ReferenceLine y={s.waterLevel.alarmLimit} stroke="#ef4444" strokeDasharray="4 2"
                          label={{ value: 'Alarm', fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }}/>
                        <Area type="monotone" dataKey="water_level_cm" stroke={risk.color} strokeWidth={2} fill={`url(#grad-${s.id})`}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Weather mini chart */}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <CloudRain size={11}/> Opad (ostatnie 72h)
                  </p>
                  <div className="h-24 bg-slate-800/30 rounded-lg p-2 border border-slate-700/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weatherVisible} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
                        <XAxis dataKey="timestamp" stroke="#475569" fontSize={7} tickFormatter={v => {
                          const h = Math.round((new Date(v).getTime() - new Date('2025-05-25T12:00:00').getTime()) / 3600000);
                          return h === 0 ? 'Teraz' : `${h}h`;
                        }} minTickGap={20}/>
                        <YAxis stroke="#475569" fontSize={8}/>
                        <Bar dataKey="rainfall_mm" fill="#3b82f6" radius={[2,2,0,0]} opacity={0.8}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-800/40 rounded p-2 border border-slate-700/40 text-xs">
                      <p className="text-slate-500 text-[10px]">Opad 24h</p>
                      <p className="text-blue-300 font-mono font-bold">{weatherNow.rainfall_24h_mm} mm</p>
                    </div>
                    <div className="bg-slate-800/40 rounded p-2 border border-slate-700/40 text-xs">
                      <p className="text-slate-500 text-[10px]">Opad 72h</p>
                      <p className="text-blue-400 font-mono font-bold">{weatherNow.rainfall_72h_mm} mm</p>
                    </div>
                  </div>
                </div>

                {/* Dominant Factor */}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Info size={11}/> Dominant Factor
                  </p>
                  <div className="bg-slate-800/70 rounded-lg border border-slate-700 p-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full shrink-0 ${ef.bg} ${ef.color}`}>{ef.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold uppercase tracking-wider ${ef.color}`}>{ef.label}</p>
                        <p className="text-slate-300 text-xs mt-1 leading-snug">{s.dominantFactor.message}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                          <div className="bg-slate-900/60 rounded p-2">
                            <p className="text-slate-500 mb-0.5">Parametr</p>
                            <p className="text-slate-200 font-mono">{s.dominantFactor.metadata.label}</p>
                            <p className={`font-bold font-mono ${ef.color}`}>{s.dominantFactor.metadata.value}</p>
                          </div>
                          <div className="bg-slate-900/60 rounded p-2">
                            <p className="text-slate-500 mb-0.5">Próg wyzwalający</p>
                            <p className="text-slate-200 font-mono">{s.dominantFactor.metadata.threshold}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SHAP */}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">SHAP – Ważność Cech Modelu</p>
                  <div className="space-y-1.5">
                    {s.shapFeatures.map(f => (
                      <div key={f.name}>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-slate-300 font-mono truncate max-w-[260px]">{f.name}</span>
                          <span className="text-slate-500 shrink-0 ml-1">{(f.importance * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${f.importance * 100}%`, backgroundColor: risk.color, opacity: 0.75 }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confidence */}
                <div className="pb-1">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-400">Pewność predykcji</span>
                    <span className="text-white font-mono font-bold">{Math.round(s.dominantFactor.confidence * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full transition-all duration-700"
                      style={{ width: `${s.dominantFactor.confidence * 100}%` }}/>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Severity: {s.dominantFactor.severity.toFixed(2)} · Bazuje na danych historycznych 2021–2025
                  </p>
                </div>
              </>)}

              {/* ── TAB: HISTORY ── */}
              {tab === 'history' && (<>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                  Historyczne epizody krytyczne (próg: {s.waterLevel.alarmLimit} cm)
                </p>
                {(HISTORICAL_EPISODES[s.id] ?? []).length === 0 ? (
                  <p className="text-slate-500 text-sm">Brak epizodów powyżej progu.</p>
                ) : (
                  <div className="space-y-2">
                    {(HISTORICAL_EPISODES[s.id] ?? []).map((ep, i) => (
                      <div key={i} className="bg-slate-800/60 rounded-lg border border-slate-700/50 p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-bold text-white">{new Date(ep.peak_timestamp).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {new Date(ep.start).toLocaleDateString('pl-PL', { day:'numeric', month:'short' })} – {new Date(ep.end).toLocaleDateString('pl-PL', { day:'numeric', month:'short' })} · {ep.duration_hours}h
                            </p>
                          </div>
                          <span className="text-lg font-mono font-bold text-red-400">{ep.peak_cm}<span className="text-xs text-slate-500">cm</span></span>
                        </div>
                        <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${Math.min(100, (ep.peak_cm / 200) * 100)}%` }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>)}

              {/* ── TAB: SEASONAL ── */}
              {tab === 'seasonal' && (<>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Analiza Sezonowa (śr. poziom wody)</p>
                <div className="h-36 bg-slate-800/30 rounded-lg p-2 border border-slate-700/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={SEASONAL_STATS[s.id] ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                      <XAxis dataKey="season" stroke="#475569" fontSize={10}/>
                      <YAxis stroke="#475569" fontSize={9}/>
                      <RTooltip contentStyle={{ backgroundColor:'#0f172a', border:'1px solid #334155', borderRadius:'8px', fontSize:'12px' }}/>
                      <Bar dataKey="mean_cm" radius={[4,4,0,0]} label={{ position:'top', fontSize:9, fill:'#94a3b8' }}>
                        {(SEASONAL_STATS[s.id] ?? []).map((_, i) => (
                          <Cell key={i} fill={['#22d3ee','#3b82f6','#f59e0b','#ef4444'][i % 4]}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">Miesięczny profil poziomu</p>
                {(MONTHLY_STATS[s.id] ?? []).length > 0 ? (
                  <div className="h-36 bg-slate-800/30 rounded-lg p-2 border border-slate-700/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(MONTHLY_STATS[s.id] ?? []).map(m => ({ ...m, month_label: MONTHS_PL[m.month - 1] }))} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                        <XAxis dataKey="month_label" stroke="#475569" fontSize={9}/>
                        <YAxis stroke="#475569" fontSize={9}/>
                        <RTooltip contentStyle={{ backgroundColor:'#0f172a', border:'1px solid #334155', borderRadius:'8px', fontSize:'12px' }}/>
                        <Line type="monotone" dataKey="mean_cm" stroke="#22d3ee" strokeWidth={2} dot={false}/>
                        <Line type="monotone" dataKey="max_cm" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 2"/>
                        <Line type="monotone" dataKey="min_cm" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="4 2"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs">Dane miesięczne dostępne dla Northern Port.</p>
                )}

                <div className="flex gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5 text-cyan-400"><div className="w-4 h-0.5 bg-cyan-400"/>Średnia</div>
                  <div className="flex items-center gap-1.5 text-red-400"><div className="w-4 h-0.5 bg-red-400 opacity-70" style={{backgroundImage:'repeating-linear-gradient(90deg,#ef4444 0,#ef4444 4px,transparent 4px,transparent 6px)'}}/>Max</div>
                  <div className="flex items-center gap-1.5 text-emerald-400"><div className="w-4 h-0.5 bg-emerald-400 opacity-70" style={{backgroundImage:'repeating-linear-gradient(90deg,#22c55e 0,#22c55e 4px,transparent 4px,transparent 6px)'}}/>Min</div>
                </div>
              </>)}

              {/* ── TAB: SIMILAR EPISODES ── */}
              {tab === 'similar' && (<>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                  Podobne zdarzenia historyczne (opad 72h ≈ {weatherNow.rainfall_72h_mm} mm)
                </p>
                <p className="text-[11px] text-slate-500 -mt-2">
                  System porównuje aktualne warunki pogodowe z podobnymi epizodami z lat 2021–2025.
                </p>
                <div className="space-y-3">
                  {(SIMILAR_EPISODES[s.id] ?? []).map((ep, i) => (
                    <div key={i} className="bg-slate-800/60 rounded-lg border border-slate-700/50 p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold text-white">
                            {new Date(ep.timestamp).toLocaleDateString('pl-PL', { day:'numeric', month:'long', year:'numeric' })}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Opad 72h: <span className="text-blue-300 font-mono">{ep.rain_72h_mm} mm</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-mono font-bold" style={{ color: risk.color }}>{ep.water_level_cm}<span className="text-xs text-slate-500">cm</span></p>
                          <p className="text-[10px] text-slate-500">maks. poziom</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${ep.similarity_score * 100}%` }}/>
                        </div>
                        <span className="text-[11px] text-cyan-400 font-mono shrink-0">{(ep.similarity_score * 100).toFixed(0)}% zgodność</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>)}

            </div>
          </div>
        )}

        {/* ══ REPORTS PANEL ═════════════════════════════════════════════ */}
        {showReports && (
          <div className="absolute top-4 right-4 bottom-[108px] w-[440px] flex flex-col bg-slate-900/97 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-[1000] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FileText size={16} className="text-cyan-400"/> Raport Modeli ML
              </h3>
              <button onClick={() => setShowReports(false)} className="text-slate-500 hover:text-white"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              {/* Model comparison bar chart */}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Porównanie Dokładności (Test Accuracy)</p>
                <div className="h-32 bg-slate-800/30 rounded-lg p-2 border border-slate-700/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={MODEL_REPORTS.map(m => ({ name: m.model_name.replace('_classifier','').replace('_regression',''), accuracy: +(m.accuracy * 100).toFixed(1) }))}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10}/>
                      <YAxis stroke="#475569" fontSize={9} domain={[70, 100]}/>
                      <RTooltip contentStyle={{ backgroundColor:'#0f172a', border:'1px solid #334155', borderRadius:'8px', fontSize:'12px' }}
                        formatter={(v:number) => [`${v}%`, 'Accuracy']}/>
                      <Bar dataKey="accuracy" radius={[4,4,0,0]} label={{ position:'top', fontSize:9, fill:'#94a3b8', formatter:(v:number)=>`${v}%` }}>
                        {MODEL_REPORTS.map((_, i) => <Cell key={i} fill={['#22d3ee','#3b82f6','#8b5cf6'][i]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Model cards */}
              <div className="space-y-3">
                {MODEL_REPORTS.map((m, i) => (
                  <div key={m.model_id} className={`rounded-lg border p-3 ${i === 0 ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-700/50 bg-slate-800/40'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        {i === 0 && <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">★ Najlepszy model</span>}
                        <p className="font-bold text-sm text-white mt-0.5">{m.model_name}</p>
                        <p className="text-[11px] text-slate-500">{m.experiment_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-mono font-bold text-white">{(m.accuracy * 100).toFixed(1)}<span className="text-sm text-slate-400">%</span></p>
                        <p className="text-[10px] text-slate-500">test accuracy</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                      <div className="bg-slate-900/60 rounded p-1.5 text-center">
                        <p className="text-slate-500 text-[10px]">Val. Acc.</p>
                        <p className="text-cyan-300 font-mono">{(m.best_validation_accuracy * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-slate-900/60 rounded p-1.5 text-center">
                        <p className="text-slate-500 text-[10px]">Epoki</p>
                        <p className="text-slate-200 font-mono">{m.epochs}</p>
                      </div>
                      <div className="bg-slate-900/60 rounded p-1.5 text-center">
                        <p className="text-slate-500 text-[10px]">Próbki</p>
                        <p className="text-slate-200 font-mono">{m.test_rows.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.classes.map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Note about SHAP */}
              <div className="rounded-lg border border-slate-700/40 bg-slate-800/40 p-3 text-[11px] text-slate-400">
                <p className="text-slate-300 font-semibold mb-1">ℹ SHAP Feature Importance</p>
                <p>Dane SHAP dostępne po uruchomieniu komendy <code className="text-cyan-400 font-mono">uv run python -m src.cli.explain</code>. Wyniki pojawią się w <code className="text-slate-300 font-mono">reports/explainability/</code>.</p>
              </div>

              {/* Export button */}
              <button className="w-full py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/30 transition-all"
                onClick={() => {
                  const csv = ['model_id,model_name,accuracy,val_accuracy,epochs,test_rows', ...MODEL_REPORTS.map(m => `${m.model_id},${m.model_name},${m.accuracy},${m.best_validation_accuracy},${m.epochs},${m.test_rows}`)].join('\n');
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
                  a.download = 'port_canals_model_report.csv';
                  a.click();
                }}>
                ↓ Eksportuj raport CSV
              </button>

            </div>
          </div>
        )}

        {/* ══ TIMELINE SLIDER ════════════════════════════════════════════ */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[58%] max-w-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl py-3 px-6 z-[1000] shadow-2xl">
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider mb-2">
            <span className="text-slate-500">Historia (−72h)</span>
            <span className="text-white">Teraz</span>
            <span className="text-cyan-400">Predykcja (+48h)</span>
          </div>
          <div className="relative h-5 flex items-center">
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-gradient-to-r from-slate-700 via-slate-500 to-cyan-500/60"/>
            <div className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] pointer-events-none"
              style={{ left: `${((timeValue + 72) / 120) * 100}%`, transform: 'translateX(-50%)' }}/>
            <input type="range" min={-72} max={48} step={3} value={timeValue}
              onChange={e => setTimeValue(+e.target.value)}
              className="w-full absolute inset-0 opacity-0 cursor-pointer z-10"/>
          </div>
          <p className="text-center text-xs font-mono text-cyan-300 mt-2">{sliderLabel(timeValue)}</p>
        </div>

        {/* Open inspector fab if closed */}
        {!inspectorOpen && (
          <button onClick={() => setInspectorOpen(true)}
            className="absolute top-4 left-4 z-[1000] bg-slate-900/95 border border-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-xl">
            <Info size={14}/> {s.short_name}
          </button>
        )}
      </div>
    </div>
  );
}
