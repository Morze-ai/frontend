import type { DashboardPayload } from './dashboard-types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export async function loadDashboard(): Promise<DashboardPayload> {
  const response = await fetch(`${API_BASE}/dashboard`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to load dashboard data (${response.status})`);
  }

  return response.json() as Promise<DashboardPayload>;
}
