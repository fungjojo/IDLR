import { type Response, type NextFunction } from 'express'
import { IdempotencyKey } from '../models/IdempotencyKey'
import { type AuthRequest } from './auth'

export async function idempotency(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers['idempotency-key']
  if (!key || typeof key !== 'string') {
    next()
    return
  }

  const userId = req.user!.id

  const cached = await IdempotencyKey.findOne({ key, userId })
  if (cached) {
    res.status(cached.statusCode).json(JSON.parse(cached.body))
    return
  }

  // Intercept res.json to capture the response before it's sent
  const originalJson = res.json.bind(res)
  res.json = (body: unknown) => {
    IdempotencyKey.create({
      key,
      userId,
      statusCode: res.statusCode,
      body: JSON.stringify(body),
    }).catch(() => {
      // Non-fatal — if we can't cache the key the request still succeeds
    })
    return originalJson(body)
  }

  next()
}
