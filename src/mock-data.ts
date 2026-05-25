// ─── mock-data.ts ──────────────────────────────────────────────────────────
// Realistic mock data mirroring the backend data structure.
// Ready to be swapped for real API calls when backend routes are available.

export type RiskLevel = 'Critical' | 'Warning' | 'Safe';
export type EventType = 'long_rainfall' | 'flash_flood' | 'thaw' | 'seasonal_dependency';

export interface WaterDataPoint {
  timestamp: string;
  water_level_cm: number;
}

export interface WeatherDataPoint {
  timestamp: string;
  rainfall_mm: number;
  temperature_c: number;
  pressure_hpa: number;
}

export interface DominantFactor {
  event_type: EventType;
  message: string;
  confidence: number;
  severity: number;
  metadata: { label: string; value: string; threshold: string };
}

export interface HistoricalEpisode {
  start: string;
  end: string;
  peak_timestamp: string;
  peak_cm: number;
  duration_hours: number;
}

export interface SimilarEpisode {
  timestamp: string;
  rain_72h_mm: number;
  water_level_cm: number;
  similarity_score: number;
}

export interface SeasonalStats {
  season: string;
  mean_cm: number;
  min_cm: number;
  max_cm: number;
}

export interface MonthlyStats {
  month: number;
  mean_cm: number;
  min_cm: number;
  max_cm: number;
  std_cm: number;
}

export interface ModelReport {
  model_id: string;
  model_name: string;
  experiment_name: string;
  accuracy: number;
  test_rows: number;
  best_validation_accuracy: number;
  epochs: number;
  classes: string[];
}

export interface Station {
  id: string;
  name: string;
  short_name: string;
  coords: [number, number];
  description: string;
  riskLevel: RiskLevel;
  waterLevel: { current: number; predicted: number; alarmLimit: number };
  dominantFactor: DominantFactor;
  shapFeatures: { name: string; importance: number }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const seed = (n: number) => Math.sin(n * 127.1) * 43758.5453 % 1;

export function genWaterSeries(
  base: number,
  trend: 'up' | 'stable' | 'down',
  stationSeed: number,
): WaterDataPoint[] {
  const pts: WaterDataPoint[] = [];
  let v = base - 15;
  const now = new Date('2025-05-25T12:00:00');
  for (let h = -72; h <= 48; h += 3) {
    const r = seed(stationSeed + h);
    const noise = (r - 0.5) * 10;
    if (h <= 0) {
      v += noise * 0.6;
    } else {
      if (trend === 'up') v += Math.abs(noise) * 0.9 + 1.5;
      else if (trend === 'down') v -= Math.abs(noise) * 0.5;
      else v += noise * 0.3;
    }
    const ts = new Date(now.getTime() + h * 3600 * 1000);
    pts.push({ timestamp: ts.toISOString(), water_level_cm: Math.round(v * 10) / 10 });
  }
  return pts;
}

export function genWeatherSeries(stationSeed: number): WeatherDataPoint[] {
  const pts: WeatherDataPoint[] = [];
  const now = new Date('2025-05-25T12:00:00');
  let rain = 0;
  let temp = 8;
  let pres = 1008;
  for (let h = -72; h <= 48; h += 3) {
    const r = seed(stationSeed + h * 7);
    rain = Math.max(0, r > 0.7 ? (r - 0.7) * 20 : 0);
    temp += (seed(stationSeed + h * 13) - 0.5) * 2;
    pres += (seed(stationSeed + h * 11) - 0.5) * 3;
    const ts = new Date(now.getTime() + h * 3600 * 1000);
    pts.push({
      timestamp: ts.toISOString(),
      rainfall_mm: Math.round(rain * 100) / 100,
      temperature_c: Math.round(temp * 10) / 10,
      pressure_hpa: Math.round(pres * 10) / 10,
    });
  }
  return pts;
}

// ── Station definitions ────────────────────────────────────────────────────
export const STATIONS: Station[] = [
  {
    id: 'northern_port',
    name: 'Port Gdańsk (Northern Port)',
    short_name: 'Northern Port',
    coords: [54.3755, 18.6603],
    description: 'Główny port Gdańska – ujście Martwej Wisły do Zatoki Gdańskiej.',
    riskLevel: 'Critical',
    waterLevel: { current: 127, predicted: 172, alarmLimit: 140 },
    dominantFactor: {
      event_type: 'long_rainfall',
      message: 'Zlewnia jest nasycona – nawet umiarkowany opad może podnieść poziom wody.',
      confidence: 0.92, severity: 0.86,
      metadata: { label: 'Opad skumulowany 72h', value: '47 mm', threshold: '≥ 40 mm' },
    },
    shapFeatures: [
      { name: 'rainfall_mm_lag_24h', importance: 0.38 },
      { name: 'rainfall_mm_lag_72h', importance: 0.29 },
      { name: 'pressure_hpa_lag_12h', importance: 0.18 },
      { name: 'season', importance: 0.09 },
      { name: 'temperature_c', importance: 0.06 },
    ],
  },
  {
    id: 'dead_vistula',
    name: 'Martwa Wisła',
    short_name: 'Martwa Wisła',
    coords: [54.3612, 18.6891],
    description: 'Kanał łączący Wisłę z Zatoką Gdańską – kluczowy dla przepływu wód powodziowych.',
    riskLevel: 'Warning',
    waterLevel: { current: 78, predicted: 105, alarmLimit: 120 },
    dominantFactor: {
      event_type: 'flash_flood',
      message: 'Wysoka intensywność opadu sprzyja gwałtownemu wzrostowi poziomu wody.',
      confidence: 0.81, severity: 0.58,
      metadata: { label: 'Intensywność opadu', value: '5.2 mm/h', threshold: '≥ 90. percentyl (4.8 mm/h)' },
    },
    shapFeatures: [
      { name: 'rainfall_mm_max_3h', importance: 0.45 },
      { name: 'rainfall_mm_lag_6h', importance: 0.27 },
      { name: 'wind_speed_ms', importance: 0.15 },
      { name: 'pressure_hpa', importance: 0.08 },
      { name: 'hour_of_day', importance: 0.05 },
    ],
  },
  {
    id: 'strzyza',
    name: 'Strzyża',
    short_name: 'Strzyża',
    coords: [54.3818, 18.5920],
    description: 'Rzeka przepływająca przez Wrzeszcz i Oliwę – czułościomierz lokalnych opadów.',
    riskLevel: 'Safe',
    waterLevel: { current: 18, predicted: 22, alarmLimit: 80 },
    dominantFactor: {
      event_type: 'seasonal_dependency',
      message: 'W tym sezonie dominują inne czynniki podnoszące poziom wody. Aktualny sezon: Wiosna.',
      confidence: 0.97, severity: 0.12,
      metadata: { label: 'Sezon hydrologiczny', value: 'Wiosna', threshold: '—' },
    },
    shapFeatures: [
      { name: 'season', importance: 0.52 },
      { name: 'day_of_year', importance: 0.23 },
      { name: 'is_growing_season', importance: 0.14 },
      { name: 'temperature_c', importance: 0.07 },
      { name: 'pressure_hpa', importance: 0.04 },
    ],
  },
];

// ── Historical episodes (per station) ─────────────────────────────────────
export const HISTORICAL_EPISODES: Record<string, HistoricalEpisode[]> = {
  northern_port: [
    { start: '2021-09-18T06:00', end: '2021-09-20T14:00', peak_timestamp: '2021-09-19T08:00', peak_cm: 198, duration_hours: 56 },
    { start: '2022-11-02T12:00', end: '2022-11-04T18:00', peak_timestamp: '2022-11-03T10:00', peak_cm: 184, duration_hours: 54 },
    { start: '2023-01-14T00:00', end: '2023-01-15T20:00', peak_timestamp: '2023-01-14T22:00', peak_cm: 167, duration_hours: 44 },
    { start: '2024-10-31T06:00', end: '2024-11-01T22:00', peak_timestamp: '2024-10-31T20:00', peak_cm: 155, duration_hours: 40 },
    { start: '2025-02-10T08:00', end: '2025-02-11T20:00', peak_timestamp: '2025-02-10T18:00', peak_cm: 143, duration_hours: 36 },
  ],
  dead_vistula: [
    { start: '2021-09-18T08:00', end: '2021-09-20T16:00', peak_timestamp: '2021-09-19T10:00', peak_cm: 162, duration_hours: 56 },
    { start: '2022-11-03T06:00', end: '2022-11-05T00:00', peak_timestamp: '2022-11-04T04:00', peak_cm: 148, duration_hours: 42 },
    { start: '2024-03-22T10:00', end: '2024-03-24T08:00', peak_timestamp: '2024-03-23T06:00', peak_cm: 139, duration_hours: 46 },
  ],
  strzyza: [
    { start: '2021-07-10T12:00', end: '2021-07-11T08:00', peak_timestamp: '2021-07-10T22:00', peak_cm: 88, duration_hours: 20 },
    { start: '2022-06-24T14:00', end: '2022-06-25T06:00', peak_timestamp: '2022-06-24T20:00', peak_cm: 82, duration_hours: 16 },
  ],
};

// ── Similar historical episodes ─────────────────────────────────────────────
export const SIMILAR_EPISODES: Record<string, SimilarEpisode[]> = {
  northern_port: [
    { timestamp: '2022-11-03T10:00', rain_72h_mm: 44.2, water_level_cm: 179, similarity_score: 0.95 },
    { timestamp: '2021-09-18T08:00', rain_72h_mm: 51.8, water_level_cm: 194, similarity_score: 0.88 },
    { timestamp: '2023-01-14T22:00', rain_72h_mm: 38.7, water_level_cm: 162, similarity_score: 0.82 },
  ],
  dead_vistula: [
    { timestamp: '2022-11-04T04:00', rain_72h_mm: 43.1, water_level_cm: 141, similarity_score: 0.91 },
    { timestamp: '2024-03-23T06:00', rain_72h_mm: 29.5, water_level_cm: 132, similarity_score: 0.79 },
    { timestamp: '2021-09-19T10:00', rain_72h_mm: 49.3, water_level_cm: 158, similarity_score: 0.76 },
  ],
  strzyza: [
    { timestamp: '2022-06-24T20:00', rain_72h_mm: 15.2, water_level_cm: 79, similarity_score: 0.88 },
    { timestamp: '2021-07-10T22:00', rain_72h_mm: 18.4, water_level_cm: 83, similarity_score: 0.82 },
    { timestamp: '2023-08-05T14:00', rain_72h_mm: 11.8, water_level_cm: 72, similarity_score: 0.74 },
  ],
};

// ── Seasonal stats ──────────────────────────────────────────────────────────
export const SEASONAL_STATS: Record<string, SeasonalStats[]> = {
  northern_port: [
    { season: 'Zima', mean_cm: 98, min_cm: 22, max_cm: 198 },
    { season: 'Wiosna', mean_cm: 82, min_cm: 18, max_cm: 162 },
    { season: 'Lato', mean_cm: 61, min_cm: 12, max_cm: 141 },
    { season: 'Jesień', mean_cm: 110, min_cm: 28, max_cm: 192 },
  ],
  dead_vistula: [
    { season: 'Zima', mean_cm: 68, min_cm: -8, max_cm: 162 },
    { season: 'Wiosna', mean_cm: 54, min_cm: -12, max_cm: 128 },
    { season: 'Lato', mean_cm: 38, min_cm: -18, max_cm: 108 },
    { season: 'Jesień', mean_cm: 79, min_cm: -4, max_cm: 158 },
  ],
  strzyza: [
    { season: 'Zima', mean_cm: 28, min_cm: -22, max_cm: 88 },
    { season: 'Wiosna', mean_cm: 22, min_cm: -18, max_cm: 72 },
    { season: 'Lato', mean_cm: 14, min_cm: -24, max_cm: 88 },
    { season: 'Jesień', mean_cm: 31, min_cm: -16, max_cm: 78 },
  ],
};

export const MONTHLY_STATS: Record<string, MonthlyStats[]> = {
  northern_port: [
    { month: 1, mean_cm: 101, min_cm: 28, max_cm: 198, std_cm: 28.4 },
    { month: 2, mean_cm: 94, min_cm: 22, max_cm: 182, std_cm: 26.1 },
    { month: 3, mean_cm: 88, min_cm: 20, max_cm: 168, std_cm: 24.8 },
    { month: 4, mean_cm: 78, min_cm: 18, max_cm: 152, std_cm: 22.3 },
    { month: 5, mean_cm: 68, min_cm: 14, max_cm: 138, std_cm: 20.1 },
    { month: 6, mean_cm: 54, min_cm: 10, max_cm: 122, std_cm: 17.8 },
    { month: 7, mean_cm: 48, min_cm: 8, max_cm: 118, std_cm: 16.2 },
    { month: 8, mean_cm: 52, min_cm: 10, max_cm: 128, std_cm: 17.4 },
    { month: 9, mean_cm: 82, min_cm: 18, max_cm: 194, std_cm: 29.8 },
    { month: 10, mean_cm: 104, min_cm: 24, max_cm: 192, std_cm: 31.2 },
    { month: 11, mean_cm: 112, min_cm: 26, max_cm: 188, std_cm: 29.4 },
    { month: 12, mean_cm: 108, min_cm: 28, max_cm: 196, std_cm: 30.1 },
  ],
  dead_vistula: [],
  strzyza: [],
};

// ── Model reports ───────────────────────────────────────────────────────────
export const MODEL_REPORTS: ModelReport[] = [
  { model_id: 'mlp_water_level', model_name: 'mlp_classifier', experiment_name: 'mlp_water_level_classification', accuracy: 0.8741, best_validation_accuracy: 0.8612, test_rows: 2184, epochs: 150, classes: ['low', 'medium', 'high', 'critical'] },
  { model_id: 'linear_water_level', model_name: 'linear_classifier', experiment_name: 'linear_water_level_classification', accuracy: 0.8124, best_validation_accuracy: 0.7981, test_rows: 2184, epochs: 100, classes: ['low', 'medium', 'high', 'critical'] },
  { model_id: 'logistic_water_level', model_name: 'logistic_regression', experiment_name: 'logistic_water_level_classification', accuracy: 0.7883, best_validation_accuracy: 0.7720, test_rows: 2184, epochs: 80, classes: ['low', 'high'] },
];

// ── Weather (shared) ───────────────────────────────────────────────────────
export const WEATHER_SERIES = genWeatherSeries(42);
export const CURRENT_WEATHER = {
  timestamp: '2025-05-25T12:00:00',
  rainfall_mm: 1.6,
  temperature_c: 9.4,
  pressure_hpa: 1008.2,
  rainfall_24h_mm: 8.4,
  rainfall_72h_mm: 47.2,
};

// ── Pre-generated water series per station ─────────────────────────────────
export const WATER_SERIES: Record<string, WaterDataPoint[]> = {
  northern_port: genWaterSeries(127, 'up', 1),
  dead_vistula: genWaterSeries(78, 'stable', 2),
  strzyza: genWaterSeries(18, 'stable', 3),
};

export const MONTHS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
