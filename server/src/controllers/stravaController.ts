import { randomBytes } from 'crypto'
import type { Request, Response } from 'express'
import { User } from '../models/User'
import { Activity } from '../models/Activity'
import {
  exchangeCode,
  refreshAccessToken,
  fetchActivities,
  fetchActivityStreams,
  normaliseActivity,
  type StravaActivity,
} from '../services/stravaService'
import { logger } from '../utils/logger'
import type { AuthRequest } from '../middleware/auth'

const STATE_COOKIE = 'strava_state'
const CLIENT_URL = () => process.env.CLIENT_URL ?? ''

export function stravaConnect(_req: Request, res: Response): void {
  const { STRAVA_CLIENT_ID, STRAVA_REDIRECT_URI } = process.env
  if (!STRAVA_CLIENT_ID || !STRAVA_REDIRECT_URI) {
    res.status(503).json({ message: 'Strava integration not configured' })
    return
  }

  const state = randomBytes(16).toString('hex')
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  })

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  })
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`)
}

export async function stravaCallback(req: AuthRequest, res: Response): Promise<void> {
  const { code, error, state } = req.query as Record<string, string>
  const expectedState = req.cookies?.[STATE_COOKIE] as string | undefined
  res.clearCookie(STATE_COOKIE)

  if (error || !code || !state || state !== expectedState) {
    res.redirect(`${CLIENT_URL()}/profile?strava=denied`)
    return
  }

  try {
    const tokens = await exchangeCode(code)
    await User.findByIdAndUpdate(req.user!.id, {
      stravaAccessToken: tokens.access_token,
      stravaRefreshToken: tokens.refresh_token,
      stravaTokenExpiresAt: tokens.expires_at,
      stravaAthleteId: tokens.athlete?.id,
    })
    logger.info({ event: 'strava.connected', userId: req.user!.id }, 'Strava connected')
    res.redirect(`${CLIENT_URL()}/profile?strava=connected`)
  } catch (err) {
    logger.error({ err }, 'Strava callback failed')
    res.redirect(`${CLIENT_URL()}/profile?strava=error`)
  }
}

export async function stravaSync(req: AuthRequest, res: Response): Promise<void> {
  let user
  try {
    user = await User.findById(req.user!.id)
  } catch (err) {
    logger.error({ err }, 'Failed to look up user for Strava sync')
    res.status(500).json({ message: 'Server error' })
    return
  }

  if (!user?.stravaRefreshToken) {
    res.status(400).json({ message: 'Strava not connected' })
    return
  }

  let accessToken: string
  try {
    accessToken = await refreshAccessToken(user)
  } catch (err) {
    logger.error({ err }, 'Strava token refresh failed')
    res.status(502).json({ message: 'Failed to refresh Strava token' })
    return
  }

  const latest = await Activity.findOne({ userId: user._id, source: 'strava' })
    .sort({ date: -1 })
    .select('date')
  const after = latest ? Math.floor(new Date(latest.date).getTime() / 1000) : undefined

  let rawActivities: StravaActivity[]
  try {
    rawActivities = await fetchActivities(accessToken, after)
  } catch (err) {
    logger.error({ err }, 'Failed to fetch Strava activities')
    res.status(502).json({ message: 'Failed to fetch activities from Strava' })
    return
  }

  // Batch duplicate check — one query instead of N round-trips
  const incomingIds = rawActivities.map(r => r.id)
  const existingDocs = await Activity.find(
    { userId: user._id, stravaActivityId: { $in: incomingIds } },
    { stravaActivityId: 1 },
  )
  const existingIds = new Set(existingDocs.map(a => a.stravaActivityId))

  const results = { created: 0, skipped: 0 }

  for (const raw of rawActivities) {
    if (existingIds.has(raw.id)) { results.skipped++; continue }

    try {
      const { hrStream, paceStream } = await fetchActivityStreams(raw.id, accessToken)
      const data = normaliseActivity(raw, hrStream, paceStream)
      await Activity.create({ userId: user._id, source: 'strava', stravaActivityId: raw.id, ...data })
      results.created++
    } catch (err) {
      logger.warn({ err, stravaActivityId: raw.id }, 'Skipping activity due to stream fetch error')
      results.skipped++
    }
  }

  logger.info({ event: 'strava.sync', userId: req.user!.id, ...results }, 'Strava sync complete')
  res.json({ message: 'Sync complete', ...results })
}
