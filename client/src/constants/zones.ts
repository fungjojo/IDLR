export interface Zone {
  id: number
  name: string
  label: string
  minPct: number
  maxPct: number
  color: string
}

export const GARMIN_ZONES: Zone[] = [
  { id: 1, name: 'Zone 1', label: 'Warm-up',    minPct: 50, maxPct: 60, color: '#4ade80' },
  { id: 2, name: 'Zone 2', label: 'Easy',        minPct: 60, maxPct: 70, color: '#86efac' },
  { id: 3, name: 'Zone 3', label: 'Aerobic',     minPct: 70, maxPct: 80, color: '#facc15' },
  { id: 4, name: 'Zone 4', label: 'Threshold',   minPct: 80, maxPct: 90, color: '#f97316' },
  { id: 5, name: 'Zone 5', label: 'Max Effort',  minPct: 90, maxPct: 100, color: '#ef4444' },
]

export function getZoneForHR(hr: number, maxHR: number): Zone | null {
  const pct = (hr / maxHR) * 100
  return GARMIN_ZONES.find((z) => pct >= z.minPct && pct < z.maxPct) ?? null
}
