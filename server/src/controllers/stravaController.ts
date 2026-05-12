import type { Request, Response } from 'express'
import { User } from '../models/User'
import { Activity } from '../models/Activity'
import {
  exchangeCode,
  refreshAccessToken,
  fetchActivities,
  fetchActivityStreams,
  normaliseActivity,
} from '../services/stravaService'
import { logger } from '../utils/logger'
import type { AuthRequest } from '../middleware/auth'

export function stravaConnect(_req: Request, res: Response): void {
  const { STRAVA_CLIENT_ID, STRAVA_REDIRECT_URI } = process.env
  if (!STRAVA_CLIENT_ID || !STRAVA_REDIRECT_URI) {
    res.status(503).json({ message: 'Strava integration not configured' })
    return
  }
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  })
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`)
}

export async function stravaCallback(req: AuthRequest, res: Response): Promise<void> {
  const { code, error } = req.query as Record<string, string>

  if (error || !code) {
    res.redirect(`${process.env.CLIENT_URL ?? ''}/profile?strava=denied`)
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
    res.redirect(`${process.env.CLIENT_URL ?? ''}/profile?strava=connected`)
  } catch (err) {
    logger.error({ err }, 'Strava callback failed')
    res.redirect(`${process.env.CLIENT_URL ?? ''}/profile?strava=error`)
  }
}

export async function stravaSync(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id)
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

  // Sync only activities newer than the most recent one we have
  const latest = await Activity.findOne({ userId: user._id, source: 'strava' })
    .sort({ date: -1 })
    .select('date')
  const after = latest ? Math.floor(new Date(latest.date).getTime() / 1000) : undefined

  let rawActivities
  try {
    rawActivities = await fetchActivities(accessToken, after)
  } catch (err) {
    logger.error({ err }, 'Failed to fetch Strava activities')
    res.status(502).json({ message: 'Failed to fetch activities from Strava' })
    return
  }

  const results = { created: 0, skipped: 0 }

  for (const raw of rawActivities) {
    const exists = await Activity.exists({ userId: user._id, stravaActivityId: raw.id })
    if (exists) { results.skipped++; continue }

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
