import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { getUsers, deleteUser } from '../controllers/userController'
import { requireAuth } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'

const router = Router()

const deleteUserRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
})

router.get('/', requireAuth, adminOnly, getUsers)
router.delete('/:id', requireAuth, adminOnly, deleteUserRateLimiter, deleteUser)

export default router
