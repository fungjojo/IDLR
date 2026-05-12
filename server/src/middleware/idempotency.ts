import { type Response, type NextFunction } from 'express'
import { IdempotencyKey } from '../models/IdempotencyKey'
import { type AuthRequest } from './auth'
import { logger } from '../utils/logger'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_KEY_LENGTH = 36

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  )
}

export async function idempotency(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers['idempotency-key']
  if (!key || typeof key !== 'string') {
    next()
    return
  }

  if (key.length > MAX_KEY_LENGTH || !UUID_REGEX.test(key)) {
    res.status(400).json({ message: 'Idempotency-Key must be a valid UUID v4' })
    return
  }

  if (!req.user) {
    next()
    return
  }

  const userId = req.user.id

  // Insert a pending placeholder atomically to claim the key before running the handler.
  // This prevents TOCTOU: two concurrent requests with the same key both see a miss and
  // both execute the handler. Only one create wins; the other gets E11000.
  let record
  try {
    record = await IdempotencyKey.create({ key, userId })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      let cached
      try {
        cached = await IdempotencyKey.findOne({ key, userId })
      } catch (findErr) {
        next(findErr)
        return
      }
      if (cached && cached.statusCode !== 0) {
        try {
          res.status(cached.statusCode).json(JSON.parse(cached.body))
        } catch {
          res.status(500).json({ message: 'Server error' })
        }
      } else {
        // Still pending — another request is in flight with this key
        res.status(409).json({ message: 'Request already in progress' })
      }
      return
    }
    next(err)
    return
  }

  const originalJson = res.json.bind(res)
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      IdempotencyKey.updateOne(
        { _id: record._id },
        { statusCode: res.statusCode, body: JSON.stringify(body) },
      ).catch((updateErr: unknown) => {
        if (!isDuplicateKeyError(updateErr)) {
          logger.error({ err: updateErr }, 'Failed to store idempotency response')
        }
      })
    } else {
      // Non-2xx — remove placeholder so the client can retry with the same key
      IdempotencyKey.deleteOne({ _id: record._id }).catch(() => {})
    }
    return originalJson(body)
  }

  next()
}
