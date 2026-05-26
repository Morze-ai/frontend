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
  event_type: string;
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
  pdf_url?: string | null;
  report_markdown?: string | null;
  report_summary?: string | null;
}

export interface Station {
  id: string;
  name: string;
  short_name: string;
  coords: [number, number];
  description: string;
  riskLevel: 'Critical' | 'Warning' | 'Safe';
  waterLevel: { current: number; predicted: number; alarmLimit: number };
  dominantFactor: DominantFactor;
  shapFeatures: { name: string; importance: number }[];
  series: WaterDataPoint[];
  historicalEpisodes: HistoricalEpisode[];
  similarEpisodes: SimilarEpisode[];
  seasonalStats: SeasonalStats[];
  monthlyStats: MonthlyStats[];
}

export interface DashboardPayload {
  stations: Station[];
  weatherSeries: WeatherDataPoint[];
  currentWeather: {
    timestamp: string;
    rainfall_mm: number;
    temperature_c: number;
    pressure_hpa: number;
    rainfall_24h_mm: number;
    rainfall_72h_mm: number;
  };
  historicalEpisodes: Record<string, HistoricalEpisode[]>;
  similarEpisodes: Record<string, SimilarEpisode[]>;
  seasonalStats: Record<string, SeasonalStats[]>;
  monthlyStats: Record<string, MonthlyStats[]>;
  waterSeries: Record<string, WaterDataPoint[]>;
  modelReports: ModelReport[];
  monthsPl: string[];
  featureImportance: { name: string; importance: number }[];
  reportPdf: { modelId: string | null; url: string | null };
  selectedStationId: string;
}
