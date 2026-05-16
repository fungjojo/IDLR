export interface Activity {
  _id: string
  userId: string
  source: 'strava' | 'manual'
  name: string
  date: string
  distanceMeters: number
  durationSeconds: number
  avgHR: number
  maxHR: number
  hrStream: number[]
  paceStream: number[]
  cadenceAvg?: number
  elevationGainMeters?: number
}

export interface PaginatedActivities {
  activities: Activity[]
  total: number
  page: number
  pages: number
}
