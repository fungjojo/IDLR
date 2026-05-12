import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'

const router = Router()

// Idempotency applied here — controller will be implemented in step 6
router.post('/sync', requireAuth, idempotency, (_req: Request, res: Response) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
