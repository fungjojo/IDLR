import api from './api'

export interface Activity {
  _id: string
  name: string
  date: string
  distanceMeters: number
  durationSeconds: number
  avgHR: number
  maxHR: number
  source: 'strava' | 'manual'
}

export async function uploadActivity(file: File): Promise<Activity> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<Activity>('/api/activities/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Idempotency-Key': crypto.randomUUID(),
    },
  })
  return response.data
}
