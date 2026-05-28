/**
 * Normalizer — bezpieczne parsowanie odpowiedzi z backendu.
 * Gdy backend zwróci niekompletne lub zmienione dane, uzupełniamy
 * brakujące pola defaultami zamiast crashować aplikację.
 */

import type {
  DashboardPayload,
  Station,
  HistoricalEpisode,
  SimilarEpisode,
  SeasonalStats,
  MonthlyStats,
  ModelReport,
} from "./dashboard-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function safeNum(val: Raw, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(val: Raw, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

function safeArr<T>(val: Raw, mapper: (item: Raw) => T): T[] {
  if (!Array.isArray(val)) return [];
  return val.map(mapper).filter(Boolean) as T[];
}

function safeRecord<T>(
  val: Raw,
  mapper: (item: Raw) => T,
): Record<string, T[]> {
  if (!val || typeof val !== "object" || Array.isArray(val)) return {};
  const result: Record<string, T[]> = {};
  for (const key of Object.keys(val)) {
    result[key] = safeArr(val[key], mapper);
  }
  return result;
}

function normalizeHistoricalEpisode(raw: Raw): HistoricalEpisode {
  return {
    start: safeStr(raw?.start),
    end: safeStr(raw?.end),
    peak_timestamp: safeStr(raw?.peak_timestamp ?? raw?.start),
    peak_cm: safeNum(raw?.peak_cm),
    duration_hours: safeNum(raw?.duration_hours),
  };
}

function normalizeSimilarEpisode(raw: Raw): SimilarEpisode {
  return {
    timestamp: safeStr(raw?.timestamp),
    rain_72h_mm: safeNum(raw?.rain_72h_mm),
    water_level_cm: safeNum(raw?.water_level_cm),
    similarity_score: safeNum(raw?.similarity_score),
  };
}

function normalizeSeasonalStats(raw: Raw): SeasonalStats {
  return {
    season: safeStr(raw?.season, "nieznany"),
    mean_cm: safeNum(raw?.mean_cm),
    min_cm: safeNum(raw?.min_cm),
    max_cm: safeNum(raw?.max_cm),
  };
}

function normalizeMonthlyStats(raw: Raw): MonthlyStats {
  return {
    month: safeNum(raw?.month, 1),
    mean_cm: safeNum(raw?.mean_cm),
    min_cm: safeNum(raw?.min_cm),
    max_cm: safeNum(raw?.max_cm),
    std_cm: safeNum(raw?.std_cm),
  };
}

function normalizeModelReport(raw: Raw): ModelReport {
  return {
    model_id: safeStr(raw?.model_id ?? raw?.id),
    model_name: safeStr(raw?.model_name ?? raw?.name, "Nieznany model"),
    experiment_name: safeStr(raw?.experiment_name),
    accuracy: safeNum(raw?.accuracy),
    test_rows: safeNum(raw?.test_rows ?? raw?.test_size),
    best_validation_accuracy: safeNum(raw?.best_validation_accuracy ?? raw?.accuracy),
    epochs: safeNum(raw?.epochs),
    classes: Array.isArray(raw?.classes) ? raw.classes.map(String) : [],
    pdf_url: raw?.pdf_url ?? null,
    report_markdown: raw?.report_markdown ?? null,
    report_summary: raw?.report_summary ?? null,
  };
}

function normalizeStation(raw: Raw): Station {
  const riskLevel =
    raw?.riskLevel === "Critical" || raw?.riskLevel === "Warning"
      ? (raw.riskLevel as Station["riskLevel"])
      : "Safe";

  return {
    id: safeStr(raw?.id, `station-${Math.random()}`),
    name: safeStr(raw?.name, "Nieznana stacja"),
    short_name: safeStr(raw?.short_name ?? raw?.name, "Stacja"),
    coords: Array.isArray(raw?.coords) && raw.coords.length >= 2
      ? [safeNum(raw.coords[0]), safeNum(raw.coords[1])]
      : [54.35, 18.65],
    description: safeStr(raw?.description),
    riskLevel,
    waterLevel: {
      current: safeNum(raw?.waterLevel?.current ?? raw?.water_level_cm),
      predicted: safeNum(raw?.waterLevel?.predicted ?? raw?.predicted_level),
      alarmLimit: safeNum(raw?.waterLevel?.alarmLimit ?? raw?.alarm_limit, 999),
    },
    dominantFactor: {
      event_type: safeStr(raw?.dominantFactor?.event_type ?? raw?.dominant_factor?.event_type, "unknown"),
      message: safeStr(raw?.dominantFactor?.message ?? raw?.dominant_factor?.message, "Brak danych."),
      confidence: safeNum(raw?.dominantFactor?.confidence ?? raw?.dominant_factor?.confidence),
      severity: safeNum(raw?.dominantFactor?.severity ?? raw?.dominant_factor?.severity),
      metadata: {
        label: safeStr(raw?.dominantFactor?.metadata?.label),
        value: safeStr(raw?.dominantFactor?.metadata?.value ?? raw?.dominantFactor?.metadata?.value, "-"),
        threshold: safeStr(raw?.dominantFactor?.metadata?.threshold, "-"),
      },
    },
    shapFeatures: safeArr(raw?.shapFeatures, (f) => ({
      name: safeStr(f?.name),
      importance: safeNum(f?.importance),
    })),
    series: safeArr(raw?.series, (p) => ({
      timestamp: safeStr(p?.timestamp),
      water_level_cm: safeNum(p?.water_level_cm),
    })),
    historicalEpisodes: safeArr(raw?.historicalEpisodes, normalizeHistoricalEpisode),
    similarEpisodes: safeArr(raw?.similarEpisodes, normalizeSimilarEpisode),
    seasonalStats: safeArr(raw?.seasonalStats, normalizeSeasonalStats),
    monthlyStats: safeArr(raw?.monthlyStats, normalizeMonthlyStats),
  };
}

export function normalizeDashboard(raw: Raw): DashboardPayload {
  const stations = safeArr(raw?.stations, normalizeStation);

  return {
    stations,
    weatherSeries: safeArr(raw?.weatherSeries, (p) => ({
      timestamp: safeStr(p?.timestamp),
      rainfall_mm: safeNum(p?.rainfall_mm),
      temperature_c: safeNum(p?.temperature_c),
      pressure_hpa: safeNum(p?.pressure_hpa),
    })),
    currentWeather: {
      timestamp: safeStr(raw?.currentWeather?.timestamp),
      rainfall_mm: safeNum(raw?.currentWeather?.rainfall_mm),
      temperature_c: safeNum(raw?.currentWeather?.temperature_c),
      pressure_hpa: safeNum(raw?.currentWeather?.pressure_hpa, 1013),
      rainfall_24h_mm: safeNum(raw?.currentWeather?.rainfall_24h_mm),
      rainfall_72h_mm: safeNum(raw?.currentWeather?.rainfall_72h_mm),
    },
    historicalEpisodes: safeRecord(raw?.historicalEpisodes, normalizeHistoricalEpisode),
    similarEpisodes: safeRecord(raw?.similarEpisodes, normalizeSimilarEpisode),
    seasonalStats: safeRecord(raw?.seasonalStats, normalizeSeasonalStats),
    monthlyStats: safeRecord(raw?.monthlyStats, normalizeMonthlyStats),
    waterSeries: safeRecord(raw?.waterSeries, (p) => ({
      timestamp: safeStr(p?.timestamp),
      water_level_cm: safeNum(p?.water_level_cm),
    })),
    modelReports: safeArr(raw?.modelReports, normalizeModelReport),
    monthsPl: Array.isArray(raw?.monthsPl)
      ? raw.monthsPl.map(String)
      : ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"],
    featureImportance: safeArr(raw?.featureImportance, (f) => ({
      name: safeStr(f?.name),
      importance: safeNum(f?.importance),
    })),
    reportPdf: {
      modelId: raw?.reportPdf?.modelId ?? null,
      url: raw?.reportPdf?.url ?? null,
    },
    selectedStationId: safeStr(raw?.selectedStationId ?? stations[0]?.id),
  };
}
