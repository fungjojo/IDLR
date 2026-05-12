import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { stravaConnect, stravaCallback, stravaSync } from '../controllers/stravaController'

const router = Router()

router.get('/connect', requireAuth, stravaConnect)
router.get('/callback', requireAuth, stravaCallback)
router.post('/sync', requireAuth, idempotency, stravaSync)

export default router
