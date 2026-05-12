import type { IUser } from '../models/User'
import type { ActivityData } from './activityTypes'

const STRAVA_BASE = 'https://www.strava.com/api/v3'
const TOKEN_URL = 'https://www.strava.com/oauth/token'

export interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id: number }
}

export interface StravaActivity {
  id: number
  name: string
  start_date: string
  distance: number
  elapsed_time: number
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  total_elevation_gain?: number
}

interface StravaStream {
  type: string
  data: number[]
}

async function stravaFetch(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${STRAVA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Strava API error ${res.status} on ${path}`)
  }
  return res.json()
}

export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status}`)
  }
  return res.json() as Promise<StravaTokenResponse>
}

export async function refreshAccessToken(user: IUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (user.stravaAccessToken && user.stravaTokenExpiresAt && user.stravaTokenExpiresAt > now + 60) {
    return user.stravaAccessToken
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: user.stravaRefreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status}`)
  }
  const tokens = await res.json() as StravaTokenResponse

  user.stravaAccessToken = tokens.access_token
  user.stravaRefreshToken = tokens.refresh_token
  user.stravaTokenExpiresAt = tokens.expires_at
  await user.save()

  return tokens.access_token
}

export async function fetchActivities(accessToken: string, after?: number): Promise<StravaActivity[]> {
  const all: StravaActivity[] = []
  let page = 1
  while (true) {
    const params = new URLSearchParams({
      per_page: '50',
      page: String(page),
      ...(after ? { after: String(after) } : {}),
    })
    const batch = await stravaFetch(`/athlete/activities?${params}`, accessToken) as StravaActivity[]
    all.push(...batch)
    if (batch.length < 50) break
    page++
  }
  return all
}

export async function fetchActivityStreams(
  stravaActivityId: number,
  accessToken: string,
): Promise<{ hrStream: number[]; paceStream: number[] }> {
  const streams = await stravaFetch(
    `/activities/${stravaActivityId}/streams?keys=heartrate,velocity_smooth`,
    accessToken,
  ) as StravaStream[]

  const hrStream = streams.find(s => s.type === 'heartrate')?.data ?? []
  const velocityStream = streams.find(s => s.type === 'velocity_smooth')?.data ?? []
  const paceStream = velocityStream.map(v => (v > 0 ? 1000 / v : 0))

  return { hrStream, paceStream }
}

export function normaliseActivity(
  raw: StravaActivity,
  hrStream: number[],
  paceStream: number[],
): ActivityData {
  const computedMax = hrStream.length > 0
    ? hrStream.reduce((max, v) => (v > max ? v : max), 0)
    : 0
  return {
    name: raw.name,
    date: new Date(raw.start_date),
    distanceMeters: raw.distance,
    durationSeconds: raw.elapsed_time,
    avgHR: raw.average_heartrate ?? (hrStream.length > 0
      ? Math.round(hrStream.reduce((s, v) => s + v, 0) / hrStream.length)
      : 0),
    maxHR: raw.max_heartrate ?? computedMax,
    hrStream,
    paceStream,
    cadenceAvg: raw.average_cadence,
    elevationGainMeters: raw.total_elevation_gain,
  }
}
