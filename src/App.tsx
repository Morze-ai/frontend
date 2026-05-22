import React, { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import { Wind, Droplets, AlertTriangle, Activity, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import 'leaflet/dist/leaflet.css';

// --- MOCK DANYCH Z ENDPOINTÓW ---
const generateMockTimeSeries = (baseLevel: number, trend: 'up' | 'down' | 'stable') => {
  const data = [];
  let current = baseLevel - 20;
  for (let i = -72; i <= 48; i += 6) {
    if (i < 0) {
      // History
      current += (Math.random() - 0.5) * 10;
    } else {
      // Prediction
      if (trend === 'up') current += Math.random() * 8 + 2;
      else if (trend === 'down') current -= Math.random() * 5 + 1;
      else current += (Math.random() - 0.5) * 5;
    }
    data.push({
      time: i === 0 ? 'Teraz' : i < 0 ? `${i}h` : `+${i}h`,
      level: Math.round(current),
      isPrediction: i > 0
    });
  }
  return data;
};

type RiskLevel = "Critical" | "Warning" | "Safe";

interface PortData {
  id: number;
  name: string;
  coords: [number, number];
  riskLevel: RiskLevel;
  waterLevel: { current: number; predicted: number; limit: number };
  dominantFactor: { type: "wind" | "rain" | "none"; desc: string; value: string };
  confidence: number;
  timeSeries: any[];
}

const mockPortsData: PortData[] = [
  {
    id: 1,
    name: "Port Gdańsk",
    coords: [54.4033, 18.6651],
    riskLevel: "Critical",
    waterLevel: { current: 120, predicted: 165, limit: 140 },
    dominantFactor: { type: "wind", desc: "Silny wiatr północny", value: "35 węzłów" },
    confidence: 92,
    timeSeries: generateMockTimeSeries(120, 'up'),
  },
  {
    id: 2,
    name: "Port Gdynia",
    coords: [54.5312, 18.5412],
    riskLevel: "Warning",
    waterLevel: { current: 80, predicted: 100, limit: 120 },
    dominantFactor: { type: "rain", desc: "Skumulowany opad 72h", value: "45 mm" },
    confidence: 85,
    timeSeries: generateMockTimeSeries(80, 'stable'),
  },
  {
    id: 3,
    name: "Port Świnoujście",
    coords: [53.9100, 14.2642],
    riskLevel: "Safe",
    waterLevel: { current: 10, predicted: 15, limit: 100 },
    dominantFactor: { type: "none", desc: "Warunki stabilne", value: "-" },
    confidence: 98,
    timeSeries: generateMockTimeSeries(10, 'stable'),
  }
];

const riskColors = {
  Critical: "#ef4444", 
  Warning: "#eab308",  
  Safe: "#22c55e",     
};

export default function App() {
  const [selectedPort, setSelectedPort] = useState<PortData | null>(mockPortsData[0]);
  const [timeValue, setTimeValue] = useState(0); // Od -72 do +48

  // Szukanie danych dla wykresu (Custom Tooltip)
  const CustomRechartsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="text-slate-300 text-sm mb-1">{label}</p>
          <p className="text-cyan-400 font-bold font-mono">
            {payload[0].value} cm
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* 1. LEWY PANEL BAZOWY (SIDEBAR) */}
      <div className="w-80 bg-slate-900/90 backdrop-blur-md border-r border-slate-800 z-10 flex flex-col shadow-2xl relative">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-wider text-cyan-400 flex items-center gap-2">
            <Activity size={24} />
            HYDRO-PREDICT
          </h1>
          <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest">Model Wezbrań Sztormowych v1.2</p>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-sm text-slate-400 mb-4 font-semibold uppercase tracking-wider">Monitorowane Porty</h2>
          <div className="flex flex-col gap-3">
            {mockPortsData.map(port => (
              <button 
                key={port.id}
                onClick={() => setSelectedPort(port)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 text-left ${
                  selectedPort?.id === port.id 
                    ? 'bg-slate-800 border-cyan-500/50' 
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-medium text-slate-200">{port.name}</div>
                  <div className="text-xs text-slate-500 mt-1">Poziom: {port.waterLevel.current}cm</div>
                </div>
                <div className="flex items-center gap-2">
                  {port.riskLevel === 'Critical' && <AlertTriangle size={16} className="text-red-500" />}
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: riskColors[port.riskLevel], boxShadow: `0 0 10px ${riskColors[port.riskLevel]}` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. MAPA GLÓWNA */}
      <div className="flex-1 relative">
        <MapContainer 
          center={[54.2, 16.5]} 
          zoom={8} 
          style={{ height: "100%", width: "100%", zIndex: 0 }}
          zoomControl={false}
        >
          {/* CartoDB Dark Matter */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {mockPortsData.map(port => (
            <CircleMarker
              key={port.id}
              center={port.coords}
              radius={port.riskLevel === 'Critical' ? 14 : 8}
              pathOptions={{ 
                color: riskColors[port.riskLevel], 
                fillColor: riskColors[port.riskLevel], 
                fillOpacity: port.riskLevel === 'Critical' ? 0.9 : 0.7,
                weight: port.riskLevel === 'Critical' ? 3 : 2
              }}
              className={port.riskLevel === 'Critical' ? 'critical-ping-marker' : ''}
              eventHandlers={{
                click: () => setSelectedPort(port),
              }}
            >
              <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                <span className="font-semibold">{port.name}</span>
              </LeafletTooltip>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* 3. PRAWY PANEL (PORT INSPECTOR) */}
        {selectedPort && (
          <div className="absolute top-6 right-6 w-[450px] max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl p-6 z-[1000] custom-scrollbar">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedPort.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-slate-800 border`} 
                        style={{ color: riskColors[selectedPort.riskLevel], borderColor: riskColors[selectedPort.riskLevel] }}>
                    Status: {selectedPort.riskLevel}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedPort(null)} className="text-slate-500 hover:text-white transition-colors">
                ✕
              </button>
            </div>

            {/* Wskazania wody */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <div className="text-slate-400 text-xs mb-1">Obecny Poziom</div>
                <div className="text-2xl font-mono text-white">{selectedPort.waterLevel.current} <span className="text-sm text-slate-500">cm</span></div>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 relative overflow-hidden">
                <div className="text-slate-400 text-xs mb-1">Max Predykcja (+48h)</div>
                <div className="text-2xl font-mono" style={{ color: riskColors[selectedPort.riskLevel] }}>
                  {selectedPort.waterLevel.predicted} <span className="text-sm text-slate-500">cm</span>
                </div>
              </div>
            </div>

            {/* WYKRES RECHARTS - Przeszłość vs Przyszłość */}
            <div className="mb-6">
              <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity size={16} /> Trend Wezbrania
              </h3>
              <div className="h-48 w-full bg-slate-800/30 rounded-lg p-2 border border-slate-700/50">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedPort.timeSeries} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={riskColors[selectedPort.riskLevel]} stopOpacity={0.5}/>
                        <stop offset="95%" stopColor={riskColors[selectedPort.riskLevel]} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickMargin={10} minTickGap={15} />
                    <YAxis stroke="#64748b" fontSize={10} domain={['dataMin - 10', 'dataMax + 20']} />
                    <RechartsTooltip content={<CustomRechartsTooltip />} />
                    <ReferenceLine y={selectedPort.waterLevel.limit} label={{ position: 'top', value: 'Limit Alarmowy', fill: '#ef4444', fontSize: 10 }} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine x="Teraz" stroke="#e2e8f0" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Teraz', fill: '#e2e8f0', fontSize: 10 }} />
                    <Area type="monotone" dataKey="level" stroke={riskColors[selectedPort.riskLevel]} strokeWidth={2} fillOpacity={1} fill="url(#colorLevel)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Główny Czynnik Sprawczy */}
            <div className="mb-6">
              <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Info size={16} /> Dominant Factor
              </h3>
              <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${selectedPort.dominantFactor.type === 'wind' ? 'bg-cyan-500/20 text-cyan-400' : selectedPort.dominantFactor.type === 'rain' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-400'}`}>
                    {selectedPort.dominantFactor.type === 'wind' ? <Wind size={24} /> : selectedPort.dominantFactor.type === 'rain' ? <Droplets size={24} /> : <Activity size={24} />}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{selectedPort.dominantFactor.desc}</div>
                    <div className="text-sm text-slate-400 mt-1 font-mono">{selectedPort.dominantFactor.value}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pewność Predykcji */}
            <div>
               <div className="flex justify-between text-xs mb-2">
                 <span className="text-slate-400">Pewność modelu (Confidence)</span>
                 <span className="text-white font-mono">{selectedPort.confidence}%</span>
               </div>
               <div className="w-full bg-slate-800 rounded-full h-2">
                 <div className="bg-cyan-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${selectedPort.confidence}%` }}></div>
               </div>
               <p className="text-xs text-slate-500 mt-2">Wysoka zgodność z danymi historycznymi dla tego wzorca pogodowego.</p>
            </div>
          </div>
        )}

        {/* 4. DOLNY PANEL (TIMELINE SLIDER) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-2/3 max-w-3xl bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl py-4 px-8 z-[1000] shadow-2xl flex flex-col gap-2">
           <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
             <span>Historia (-72h)</span>
             <span className="text-white">Teraz</span>
             <span className="text-cyan-400">Predykcja (+48h)</span>
           </div>
           
           <div className="relative pt-2 pb-4">
             {/* Gradientowa linia osi czasu */}
             <div className="absolute top-1/2 left-0 w-full h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-slate-700 via-slate-500 to-cyan-500/50"></div>
             
             {/* Suwak (Natywny input range wystylizowany przez tailwind + custom CSS lub po prostu jako slider z Reacta. Użyjemy prostego input range) */}
             <input 
                type="range" 
                min="-72" 
                max="48" 
                step="6"
                value={timeValue}
                onChange={(e) => setTimeValue(parseInt(e.target.value))}
                className="w-full absolute top-1/2 -translate-y-1/2 appearance-none bg-transparent cursor-pointer z-10"
                style={{ WebkitAppearance: 'none' }}
             />
             
             {/* Niestandardowy uchwyt (Thumb) zrobiony poza inputem dla lepszego wyglądu, zsynchronizowany w CSS lub po prostu polegający na standardowym input thumb, 
                 ale dla prostoty nadpiszemy klasycznie styles w in-line lub zaufamy domyślnym z transparentnym tłem inputa.
                 Zrobimy mały hack ze wskaźnikiem: */}
             <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] pointer-events-none transition-all duration-100"
                style={{ left: `${((timeValue + 72) / 120) * 100}%`, transform: 'translate(-50%, -50%)' }}
             />
           </div>
           <div className="text-center text-sm font-mono text-cyan-300">
              {timeValue === 0 ? "Bieżąca godzina" : timeValue < 0 ? `${Math.abs(timeValue)}h temu` : `Prognoza za ${timeValue}h`}
           </div>
        </div>
      </div>
    </div>
  );
}
