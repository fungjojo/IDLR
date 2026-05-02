import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { login, register } from '../controllers/authController'
import { requireAuth } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'

const router = Router()

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later' },
})

router.post('/login', loginRateLimiter, login)
router.post('/register', requireAuth, adminOnly, register)

export default router
