import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import { Wind, Droplets, Snowflake, Leaf, Activity, AlertTriangle, Info, Thermometer } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import 'leaflet/dist/leaflet.css';

// ─── TYPY (odzwierciedlają backend schemas.py) ────────────────────────────────
type RiskLevel = 'Critical' | 'Warning' | 'Safe';
// EventType zgodny z backend src/events/schemas.py -> EventType(StrEnum)
type EventType = 'long_rainfall' | 'flash_flood' | 'thaw' | 'seasonal_dependency' | 'none';

interface DominantFactor {
  event_type: EventType;
  // Odpowiednik EventDetection.message z backendu
  message: string;
  // Odpowiednik EventDetection.metadata
  metadata: {
    label: string;       // np. "Opad 72h"
    value: string;       // np. "45 mm"
    threshold?: string;  // próg z EventRule.thresholds
  };
  // Odpowiednik EventDetection.confidence
  confidence: number;
  // Odpowiednik EventDetection.severity
  severity: number;
}

interface PortData {
  id: number;
  name: string;
  coords: [number, number];
  riskLevel: RiskLevel;
  waterLevel: { current: number; predicted: number; alarmLimit: number };
  dominantFactor: DominantFactor;
  // Odpowiednik SHAP feature_importance – top czynniki dla inspect panelu
  shapTopFeatures: { name: string; importance: number }[];
  timeSeries: { time: string; level: number }[];
}

// ─── MOCK DANYCH (symuluje odpowiedź z endpointów) ───────────────────────────
const genSeries = (base: number, trend: 'up' | 'stable' | 'down') => {
  const pts = [];
  let v = base - 15;
  for (let h = -72; h <= 48; h += 6) {
    v += trend === 'up' ? Math.random() * 6 + (h > 0 ? 3 : 0)
       : trend === 'down' ? -(Math.random() * 3)
       : (Math.random() - 0.5) * 8;
    pts.push({ time: h === 0 ? 'Teraz' : h < 0 ? `${h}h` : `+${h}h`, level: Math.round(v) });
  }
  return pts;
};

const PORTS: PortData[] = [
  {
    id: 1, name: 'Port Gdańsk',
    coords: [54.3755, 18.6603],
    riskLevel: 'Critical',
    waterLevel: { current: 120, predicted: 168, alarmLimit: 140 },
    dominantFactor: {
      event_type: 'long_rainfall',
      message: 'Zlewnia jest nasycona – nawet umiarkowany opad może podnieść poziom wody.',
      metadata: { label: 'Opad skumulowany 72h', value: '47 mm', threshold: '≥ 40 mm' },
      confidence: 0.92, severity: 0.85,
    },
    shapTopFeatures: [
      { name: 'rainfall_mm_lag_24h', importance: 0.38 },
      { name: 'rainfall_mm_lag_72h', importance: 0.29 },
      { name: 'pressure_hpa_lag_12h', importance: 0.18 },
      { name: 'season', importance: 0.09 },
      { name: 'temperature_c', importance: 0.06 },
    ],
    timeSeries: genSeries(120, 'up'),
  },
  {
    id: 2, name: 'Port Gdynia',
    coords: [54.5285, 18.5419],
    riskLevel: 'Warning',
    waterLevel: { current: 80, predicted: 108, alarmLimit: 120 },
    dominantFactor: {
      event_type: 'flash_flood',
      message: 'Wysoka intensywność opadu sprzyja gwałtownemu wzrostowi poziomu wody.',
      metadata: { label: 'Intensywność opadu', value: '5.2 mm/h', threshold: '≥ 4 mm/h (90. percentyl)' },
      confidence: 0.85, severity: 0.62,
    },
    shapTopFeatures: [
      { name: 'rainfall_mm_max_3h', importance: 0.45 },
      { name: 'rainfall_mm_lag_6h', importance: 0.27 },
      { name: 'wind_speed_ms', importance: 0.15 },
      { name: 'pressure_hpa', importance: 0.08 },
      { name: 'hour_of_day', importance: 0.05 },
    ],
    timeSeries: genSeries(80, 'stable'),
  },
  {
    id: 3, name: 'Port Świnoujście',
    coords: [53.9154, 14.2474],
    riskLevel: 'Warning',
    waterLevel: { current: 55, predicted: 85, alarmLimit: 120 },
    dominantFactor: {
      event_type: 'thaw',
      message: 'Warunki roztopowe mogą powodować wzrost poziomu wody.',
      metadata: { label: 'Przyrost temp. 48h', value: '+6.8°C', threshold: '≥ 5°C przy śr. 0°C' },
      confidence: 0.78, severity: 0.48,
    },
    shapTopFeatures: [
      { name: 'temperature_c_lag_48h', importance: 0.41 },
      { name: 'temperature_c_mean_24h', importance: 0.31 },
      { name: 'is_growing_season', importance: 0.14 },
      { name: 'rainfall_mm', importance: 0.09 },
      { name: 'day_of_year', importance: 0.05 },
    ],
    timeSeries: genSeries(55, 'up'),
  },
  {
    id: 4, name: 'Port Szczecin',
    coords: [53.4285, 14.5528],
    riskLevel: 'Safe',
    waterLevel: { current: 12, predicted: 18, alarmLimit: 100 },
    dominantFactor: {
      event_type: 'seasonal_dependency',
      message: 'W tym sezonie dominują inne czynniki podnoszące poziom wody.',
      metadata: { label: 'Sezon hydrologiczny', value: 'Wiosna', threshold: '—' },
      confidence: 0.97, severity: 0.10,
    },
    shapTopFeatures: [
      { name: 'season', importance: 0.52 },
      { name: 'day_of_year', importance: 0.23 },
      { name: 'is_growing_season', importance: 0.14 },
      { name: 'temperature_c', importance: 0.07 },
      { name: 'pressure_hpa', importance: 0.04 },
    ],
    timeSeries: genSeries(12, 'stable'),
  },
];

// ─── KONFIGURACJA RYZYKA ──────────────────────────────────────────────────────
const RISK = {
  Critical: { color: '#ef4444', glow: '0 0 18px #ef4444', radius: 13, label: 'KRYTYCZNY' },
  Warning:  { color: '#f59e0b', glow: '0 0 14px #f59e0b', radius: 9,  label: 'OSTRZEŻENIE' },
  Safe:     { color: '#22c55e', glow: '0 0 10px #22c55e', radius: 7,  label: 'BEZPIECZNY' },
};

// ─── KONFIGURACJA TYPÓW ZDARZEŃ (backend EventType) ──────────────────────────
const EVENT_CONFIG: Record<EventType, { icon: JSX.Element; color: string; bg: string; label: string }> = {
  long_rainfall: {
    icon: <Droplets size={22} />, color: 'text-blue-400', bg: 'bg-blue-500/20',
    label: 'Nasycenie Zlewni (72h/7d)',
  },
  flash_flood: {
    icon: <Activity size={22} />, color: 'text-orange-400', bg: 'bg-orange-500/20',
    label: 'Gwałtowna Ulewa',
  },
  thaw: {
    icon: <Snowflake size={22} />, color: 'text-cyan-300', bg: 'bg-cyan-500/20',
    label: 'Epizod Roztopowy',
  },
  seasonal_dependency: {
    icon: <Leaf size={22} />, color: 'text-emerald-400', bg: 'bg-emerald-500/20',
    label: 'Zależność Sezonowa',
  },
  none: {
    icon: <Wind size={22} />, color: 'text-slate-400', bg: 'bg-slate-700',
    label: 'Brak zdarzenia',
  },
};

// ─── CUSTOM TOOLTIP WYKRESU ───────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
        <p className="text-slate-400 mb-0.5">{label}</p>
        <p className="text-white font-mono font-bold">{payload[0].value} cm</p>
      </div>
    );
  }
  return null;
};

// ─── GŁÓWNY KOMPONENT ─────────────────────────────────────────────────────────
export default function App() {
  const [selectedPort, setSelectedPort] = useState<PortData | null>(PORTS[0]);
  const [timeValue, setTimeValue] = useState(0);

  const ef = selectedPort ? EVENT_CONFIG[selectedPort.dominantFactor.event_type] : null;
  const risk = selectedPort ? RISK[selectedPort.riskLevel] : null;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── LEWY PANEL ── */}
      <aside className="w-72 shrink-0 bg-slate-900/95 border-r border-slate-800 flex flex-col z-10 shadow-2xl">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-lg font-bold tracking-widest text-cyan-400 flex items-center gap-2 uppercase">
            <Activity size={20} /> Hydro-Predict
          </h1>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">
            Model Wezbrań Sztormowych v1.2
          </p>
        </div>

        {/* Licznik alertów */}
        <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <div>
            <p className="text-xs font-bold text-red-400">
              {PORTS.filter(p => p.riskLevel === 'Critical').length} aktywne alerty krytyczne
            </p>
            <p className="text-[10px] text-slate-500">
              {PORTS.filter(p => p.riskLevel === 'Warning').length} ostrzeżenia
            </p>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 uppercase tracking-widest px-4 pt-4 pb-2 font-semibold">
          Monitorowane Porty
        </p>

        <div className="flex-1 px-4 pb-4 flex flex-col gap-2 overflow-y-auto">
          {PORTS.map(port => {
            const r = RISK[port.riskLevel];
            const selected = selectedPort?.id === port.id;
            return (
              <button
                key={port.id}
                onClick={() => setSelectedPort(port)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all duration-150 ${
                  selected
                    ? 'bg-slate-800 border-cyan-500/60'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <p className="font-medium text-sm text-slate-100">{port.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    {port.waterLevel.current} cm · pred. {port.waterLevel.predicted} cm
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {port.riskLevel === 'Critical' && (
                    <AlertTriangle size={13} className="text-red-400" />
                  )}
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color, boxShadow: r.glow }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="p-4 border-t border-slate-800 space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Legenda ryzyka</p>
          {(['Critical','Warning','Safe'] as RiskLevel[]).map(r => (
            <div key={r} className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK[r].color }} />
              {RISK[r].label}
            </div>
          ))}
        </div>
      </aside>

      {/* ── MAPA ── */}
      <div className="flex-1 relative">
        <MapContainer
          center={[54.15, 17.5]}
          zoom={8}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {PORTS.map(port => {
            const r = RISK[port.riskLevel];
            return (
              <CircleMarker
                key={port.id}
                center={port.coords}
                radius={r.radius}
                pathOptions={{
                  color: r.color,
                  fillColor: r.color,
                  fillOpacity: port.riskLevel === 'Critical' ? 0.9 : 0.7,
                  weight: port.riskLevel === 'Critical' ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => setSelectedPort(port) }}
              >
                <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                  <strong>{port.name}</strong> · {r.label}
                </LeafletTooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* ── PANEL INSPEKTORA (lewy, nad sidebar) ── */}
        {selectedPort && ef && risk && (
          <div className="absolute top-4 left-4 bottom-[110px] w-[420px] flex flex-col bg-slate-900/97 backdrop-blur-xl border border-slate-700/60 rounded-xl shadow-2xl z-[1000] overflow-hidden">

            {/* Nagłówek */}
            <div className="flex items-start justify-between p-5 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedPort.name}</h2>
                <span
                  className="inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border"
                  style={{ color: risk.color, borderColor: risk.color, background: `${risk.color}18` }}
                >
                  {risk.label}
                </span>
              </div>
              <button onClick={() => setSelectedPort(null)} className="text-slate-500 hover:text-white text-lg leading-none mt-1">✕</button>
            </div>

            {/* Scrollowalna treść */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Poziom wody */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Aktualny', value: selectedPort.waterLevel.current, unit: 'cm', color: 'text-white' },
                  { label: 'Predykcja +48h', value: selectedPort.waterLevel.predicted, unit: 'cm', color: `text-[${risk.color}]` },
                  { label: 'Próg alarmowy', value: selectedPort.waterLevel.alarmLimit, unit: 'cm', color: 'text-red-400' },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-xl font-mono font-bold ${color}`}>{value}<span className="text-xs text-slate-500 ml-0.5">{unit}</span></p>
                  </div>
                ))}
              </div>

              {/* Wykres */}
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Activity size={13} /> Trend Wezbrania (historia + predykcja)
                </p>
                <div className="h-44 bg-slate-800/30 rounded-lg p-2 border border-slate-700/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedPort.timeSeries} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${selectedPort.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="10%" stopColor={risk.color} stopOpacity={0.5} />
                          <stop offset="95%" stopColor={risk.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" stroke="#475569" fontSize={9} tickMargin={6} minTickGap={18} />
                      <YAxis stroke="#475569" fontSize={9} domain={['dataMin - 10', 'dataMax + 15']} />
                      <RechartsTooltip content={<ChartTooltip />} />
                      <ReferenceLine
                        y={selectedPort.waterLevel.alarmLimit}
                        stroke="#ef4444"
                        strokeDasharray="4 2"
                        label={{ value: 'Alarm', fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }}
                      />
                      <ReferenceLine x="Teraz" stroke="#94a3b8" strokeDasharray="3 3" />
                      <Area
                        type="monotone" dataKey="level"
                        stroke={risk.color} strokeWidth={2}
                        fill={`url(#grad-${selectedPort.id})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dominant Factor */}
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Info size={13} /> Dominant Factor (typ zdarzenia backendu)
                </p>
                <div className="bg-slate-800/70 rounded-lg border border-slate-700 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-full shrink-0 ${ef.bg} ${ef.color}`}>
                      {ef.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${ef.color}`}>
                        {ef.label}
                      </p>
                      <p className="text-slate-200 text-sm leading-snug">
                        {selectedPort.dominantFactor.message}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/60 rounded p-2">
                          <p className="text-slate-500 mb-0.5">Mierzony parametr</p>
                          <p className="text-slate-200 font-mono">{selectedPort.dominantFactor.metadata.label}</p>
                          <p className={`font-bold font-mono ${ef.color}`}>{selectedPort.dominantFactor.metadata.value}</p>
                        </div>
                        <div className="bg-slate-900/60 rounded p-2">
                          <p className="text-slate-500 mb-0.5">Próg wyzwalający</p>
                          <p className="text-slate-200 font-mono">{selectedPort.dominantFactor.metadata.threshold}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SHAP Top Features */}
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Thermometer size={13} /> SHAP – Kluczowe Cechy Modelu
                </p>
                <div className="space-y-2">
                  {selectedPort.shapTopFeatures.map(f => (
                    <div key={f.name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-300 font-mono">{f.name}</span>
                        <span className="text-slate-400">{(f.importance * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${f.importance * 100}%`, backgroundColor: risk.color, opacity: 0.8 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pewność modelu */}
              <div className="pb-2">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Pewność predykcji (EventDetection.confidence)</span>
                  <span className="text-white font-mono font-bold">{Math.round(selectedPort.dominantFactor.confidence * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-1000"
                    style={{ width: `${selectedPort.dominantFactor.confidence * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Severity score: {selectedPort.dominantFactor.severity.toFixed(2)} · Bazuje na danych historycznych modelu
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ── TIMELINE SLIDER ── */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[55%] max-w-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl py-3 px-6 z-[1000] shadow-2xl">
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider mb-2">
            <span className="text-slate-500">Historia (−72h)</span>
            <span className="text-white">Teraz</span>
            <span className="text-cyan-400">Predykcja (+48h)</span>
          </div>
          <div className="relative h-6 flex items-center">
            {/* Track */}
            <div className="absolute inset-x-0 h-1 rounded-full bg-gradient-to-r from-slate-700 via-slate-500 to-cyan-500/60" />
            {/* Custom thumb indicator */}
            <div
              className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] pointer-events-none"
              style={{ left: `${((timeValue + 72) / 120) * 100}%`, transform: 'translateX(-50%)' }}
            />
            <input
              type="range" min={-72} max={48} step={6} value={timeValue}
              onChange={e => setTimeValue(+e.target.value)}
              className="w-full absolute inset-0 opacity-0 cursor-pointer z-10"
            />
          </div>
          <p className="text-center text-xs font-mono text-cyan-300 mt-2">
            {timeValue === 0 ? '▶ Bieżąca godzina'
              : timeValue < 0 ? `↩ ${Math.abs(timeValue)}h temu`
              : `↦ Prognoza za ${timeValue}h`}
          </p>
        </div>
      </div>
    </div>
  );
}
