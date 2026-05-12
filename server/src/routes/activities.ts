import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'

const router = Router()

// Idempotency applied here — controller will be implemented in step 5
router.post('/upload', requireAuth, idempotency, (_req: Request, res: Response) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
