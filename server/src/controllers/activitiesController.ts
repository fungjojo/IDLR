import type { Response } from 'express'
import { Activity } from '../models/Activity'
import { parseFitBuffer } from '../services/fitParser'
import { parseGpxBuffer } from '../services/gpxParser'
import type { ActivityData } from '../services/activityTypes'
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

  let activityData: ActivityData
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

export async function getActivities(req: AuthRequest, res: Response): Promise<void> {
  const rawPage = parseInt(String(req.query.page ?? '1'), 10)
  const rawLimit = parseInt(String(req.query.limit ?? '10'), 10)
  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage)
  const limit = Math.min(50, Math.max(1, Number.isNaN(rawLimit) ? 10 : rawLimit))
  const skip = (page - 1) * limit

  try {
    const [activities, total] = await Promise.all([
      Activity.find({ userId: req.user!.id }).sort({ date: -1 }).skip(skip).limit(limit),
      Activity.countDocuments({ userId: req.user!.id }),
    ])
    const pages = Math.ceil(total / limit)
    res.json({ activities, total, page, pages })
  } catch (err) {
    logger.error({ err }, 'Failed to fetch activities')
    res.status(500).json({ message: 'Server error' })
  }
}

export async function getActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const activity = await Activity.findById(req.params.id)
    if (!activity || activity.userId.toString() !== req.user!.id) {
      res.status(404).json({ message: 'Activity not found' })
      return
    }
    res.json(activity)
  } catch (err) {
    logger.error({ err }, 'Failed to fetch activity')
    res.status(500).json({ message: 'Server error' })
  }
}

export async function deleteActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const activity = await Activity.findById(req.params.id)
    if (!activity || activity.userId.toString() !== req.user!.id) {
      res.status(404).json({ message: 'Activity not found' })
      return
    }
    await activity.deleteOne()
    res.status(204).send()
  } catch (err) {
    logger.error({ err }, 'Failed to delete activity')
    res.status(500).json({ message: 'Server error' })
  }
}
