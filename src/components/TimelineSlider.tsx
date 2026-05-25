import { sliderLabel } from '../lib/format';

type TimelineSliderProps = {
  timeValue: number;
  onChange: (value: number) => void;
};

export function TimelineSlider({ timeValue, onChange }: TimelineSliderProps) {
  const position = ((timeValue + 72) / 120) * 100;

  return (
    <div className="absolute left-1/2 bottom-4 z-20 w-[min(920px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-slate-700/70 bg-slate-950/90 backdrop-blur-xl shadow-2xl px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Teraz</span>
          <span className="font-semibold text-cyan-300">Predykcja (+48h)</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Aktualna godzina</span>
          <span className="font-mono text-cyan-300">{sliderLabel(timeValue)}</span>
        </div>
        <div className="relative h-5 flex items-center">
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-gradient-to-r from-slate-700 via-slate-500 to-cyan-500/60" />
          <div
            className="absolute w-3.5 h-3.5 rounded-full bg-white ring-2 ring-slate-950 shadow-[0_0_12px_rgba(255,255,255,0.9)] pointer-events-none"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          />
          <input
            type="range"
            min={-72}
            max={48}
            step={3}
            value={timeValue}
            onChange={(event) => onChange(Number(event.target.value))}
            className="timeline-slider w-full absolute inset-0 opacity-0 cursor-pointer z-10"
          />
        </div>
        <p className="text-center text-[11px] text-slate-400">
          <span className="font-mono text-cyan-300">{sliderLabel(timeValue)}</span>
        </p>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0h</span>
          <span>24h</span>
          <span>48h</span>
        </div>
      </div>
    </div>
  );
}
