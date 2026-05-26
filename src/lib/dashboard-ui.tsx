import type { ReactNode } from 'react';

import { Activity, Droplets, Leaf, Snowflake } from 'lucide-react';
import type { Station } from './dashboard-types';

export type Tab = 'overview' | 'history' | 'seasonal' | 'similar';

export const RISK: Record<Station['riskLevel'], { color: string; glow: string; radius: number; label: string; bg: string }> = {
  Critical: { color: '#ef4444', glow: '0 0 18px #ef4444cc', radius: 14, label: 'KRYTYCZNY', bg: 'bg-red-500/15 border-red-500/40' },
  Warning: { color: '#f59e0b', glow: '0 0 12px #f59e0baa', radius: 9, label: 'OSTRZEŻENIE', bg: 'bg-amber-500/15 border-amber-500/40' },
  Safe: { color: '#22c55e', glow: '0 0 10px #22c55eaa', radius: 7, label: 'BEZPIECZNY', bg: 'bg-emerald-500/15 border-emerald-500/40' },
};

export const EVENT_CFG: Record<string, { icon: ReactNode; color: string; bg: string; label: string }> = {
  long_rainfall: { icon: <Droplets size={20} />, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Nasycenie Zlewni (72h/7d)' },
  flash_flood: { icon: <Activity size={20} />, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Gwałtowna Ulewa' },
  thaw: { icon: <Snowflake size={20} />, color: 'text-cyan-300', bg: 'bg-cyan-500/20', label: 'Epizod Roztopowy' },
  seasonal_dependency: { icon: <Leaf size={20} />, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Zależność Sezonowa' },
};