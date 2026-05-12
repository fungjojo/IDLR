import type { Response } from 'express'
import { Activity } from '../models/Activity'
import { parseFitBuffer } from '../services/fitParser'
import { parseGpxBuffer } from '../services/gpxParser'
import { logger } from '../utils/logger'
import type { AuthRequest } from '../middleware/auth'

export async function uploadActivity(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file
  if (!file) {
    res.status(400).json({ message: 'No file provided' })
    return
  }

  const ext = file.originalname.split('.').pop()?.toLowerCase()
  if (ext !== 'fit' && ext !== 'gpx') {
    res.status(400).json({ message: 'Only .fit and .gpx files are supported' })
    return
  }

  let activityData
  try {
    if (ext === 'fit') {
      activityData = await parseFitBuffer(file.buffer, file.originalname)
    } else {
      activityData = parseGpxBuffer(file.buffer, file.originalname)
    }
  } catch (err) {
    logger.error({ err }, 'Failed to parse activity file')
    res.status(422).json({ message: 'Could not parse file — check it is a valid FIT or GPX' })
    return
  }

  try {
    const activity = await Activity.create({
      userId: req.user!.id,
      source: 'manual',
      ...activityData,
    })
    res.status(201).json(activity)
  } catch (err) {
    logger.error({ err }, 'Failed to save activity')
    res.status(500).json({ message: 'Server error' })
  }
}
