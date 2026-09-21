export interface ActivityData {
  name: string
  date: Date
  distanceMeters: number
  durationSeconds: number
  avgHR: number
  maxHR: number
  hrStream: number[]
  paceStream: number[]
  cadenceAvg?: number
  elevationGainMeters?: number
  coordinates?: [number, number][]
}

// Shared by fitParser/gpxParser/stravaService so all three activity sources
// compute HR stats the same way. Uses reduce (not Math.max(...arr)) since
// spreading a large stream into Math.max can blow the call stack.
export function computeHrStats(
  hrStream: number[],
  fallback: { avgHR?: number; maxHR?: number } = {},
): { avgHR: number; maxHR: number } {
  if (hrStream.length === 0) {
    return { avgHR: fallback.avgHR ?? 0, maxHR: fallback.maxHR ?? 0 }
  }
  const avgHR = Math.round(hrStream.reduce((sum, v) => sum + v, 0) / hrStream.length)
  const maxHR = hrStream.reduce((max, v) => (v > max ? v : max), 0)
  return { avgHR, maxHR }
}

export function speedToPace(speedMetersPerSecond: number): number {
  return speedMetersPerSecond > 0 ? 1000 / speedMetersPerSecond : 0
}

export function deriveActivityName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}
