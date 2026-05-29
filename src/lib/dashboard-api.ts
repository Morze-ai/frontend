import type { DashboardPayload } from "./dashboard-types";
import { normalizeDashboard } from "./dashboard-normalize";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ?? "http://localhost:8000";

export async function loadDashboard(): Promise<DashboardPayload> {
  const response = await fetch(`${API_BASE}/dashboard`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      message ||
        `Błąd serwera (${response.status}) — spróbuj ponownie za chwilę.`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = await response.json();
  return normalizeDashboard(raw);
}

export async function loadShapFeatures(
  modelId: string = "mlp_water_level",
): Promise<{ name: string; importance: number }[]> {
  try {
    const response = await fetch(
      `${BACKEND_BASE}/shap/features?model_id=${modelId}`,
    );

    if (!response.ok) {
      return [];
    }

    return response.json() as Promise<{ name: string; importance: number }[]>;
  } catch {
    return [];
  }
}
