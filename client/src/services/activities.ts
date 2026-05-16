import api from './api'
import type { Activity, PaginatedActivities } from '../types/activity'

export type { Activity, PaginatedActivities }

export async function uploadActivity(file: File): Promise<Activity> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<Activity>('/api/activities/upload', formData, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  })
  return response.data
}

export async function fetchActivities(page: number, limit: number): Promise<PaginatedActivities> {
  const response = await api.get<PaginatedActivities>('/api/activities', {
    params: { page, limit },
  })
  return response.data
}

export async function fetchActivity(id: string): Promise<Activity> {
  const response = await api.get<Activity>(`/api/activities/${id}`)
  return response.data
}

export async function deleteActivity(id: string): Promise<void> {
  await api.delete(`/api/activities/${id}`)
}
