import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { getSessions, login, logout, me, refresh, register, revokeSession } from '../controllers/authController'
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

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts, please try again later' },
})

const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many refresh attempts, please try again later' },
})

const logoutRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many logout attempts, please try again later' },
})

const meRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests' },
})

const sessionRevokeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many session revocation attempts' },
})

router.get('/me', meRateLimiter, requireAuth, me)
router.get('/sessions', meRateLimiter, requireAuth, getSessions)
router.delete('/sessions/:jti', sessionRevokeLimiter, requireAuth, revokeSession)
router.post('/login', loginRateLimiter, login)
router.post('/refresh', refreshRateLimiter, refresh)
router.post('/logout', logoutRateLimiter, logout)
router.post('/register', registerRateLimiter, requireAuth, adminOnly, register)

export default router
