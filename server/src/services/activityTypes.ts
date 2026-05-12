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
