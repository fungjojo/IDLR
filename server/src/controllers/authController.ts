import { randomUUID } from 'crypto'
import { type Request, type Response, type CookieOptions } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { RefreshToken } from '../models/RefreshToken'
import { type AuthRequest } from '../middleware/auth'
import { logger } from '../utils/logger'

const BCRYPT_ROUNDS = 12
const MAX_PASSWORD_LENGTH = 72
const MIN_PASSWORD_LENGTH = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

const ACCESS_EXPIRES = '15m'
const REFRESH_EXPIRES = '7d'
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const ACCESS_COOKIE = 'idlr_token'
export const REFRESH_COOKIE = 'idlr_refresh'

const ISSUER = 'idlr'
const AUDIENCE = 'idlr-client'

function accessCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  }
}

function refreshCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: REFRESH_MAX_AGE_MS,
    path: '/api/auth',
  }
}

function issueTokenPair(userId: string, role: 'admin' | 'member') {
  const accessToken = jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_EXPIRES, algorithm: 'HS256', jwtid: randomUUID(), issuer: ISSUER, audience: AUDIENCE },
  )
  const refreshJti = randomUUID()
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.REFRESH_TOKEN_SECRET as string,
    { expiresIn: REFRESH_EXPIRES, algorithm: 'HS256', jwtid: refreshJti, issuer: ISSUER, audience: AUDIENCE },
  )
  return { accessToken, refreshToken, refreshJti }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password required' })
    return
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ message: 'Password too long' })
    return
  }

  const normalisedEmail = email.trim().toLowerCase()

  if (!EMAIL_REGEX.test(normalisedEmail)) {
    res.status(400).json({ message: 'Invalid email format' })
    return
  }

  try {
    const user = await User.findOne({ email: normalisedEmail })
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
      logger.warn({ event: 'auth.login.locked', email: normalisedEmail, retryAfter }, 'Login attempt on locked account')
      res.set('Retry-After', String(retryAfter))
      res.status(423).json({ message: 'Account temporarily locked. Try again later.', retryAfter })
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      const attempts = (user.loginAttempts ?? 0) + 1
      const update: { loginAttempts: number; lockedUntil?: Date } = { loginAttempts: attempts }
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS)
        logger.warn({ event: 'auth.login.lockout_triggered', email: normalisedEmail, attempts }, 'Account locked out')
      }
      await User.updateOne({ _id: user._id }, update)
      logger.warn({ event: 'auth.login.failure', email: normalisedEmail }, 'Failed login attempt')
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }

    if (user.loginAttempts > 0 || user.lockedUntil) {
      await User.updateOne({ _id: user._id }, { loginAttempts: 0, lockedUntil: null })
    }

    const userId = user._id.toString()
    const { accessToken, refreshToken, refreshJti } = issueTokenPair(userId, user.role)
    logger.info({ event: 'auth.login.success', userId, role: user.role }, 'User logged in')

    await RefreshToken.create({
      jti: refreshJti,
      userId: user._id,
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
    })

    res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions())
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions())
    res.json({
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        maxHR: user.maxHR,
      },
    })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
  if (!token) {
    res.status(401).json({ message: 'Unauthorised' })
    return
  }

  try {
    const raw = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as unknown

    if (
      typeof raw !== 'object' || raw === null ||
      !('id' in raw) || !('jti' in raw) ||
      typeof (raw as Record<string, unknown>).id !== 'string' ||
      typeof (raw as Record<string, unknown>).jti !== 'string'
    ) {
      res.status(401).json({ message: 'Invalid token' })
      return
    }

    const { id: userId, jti } = raw as { id: string; jti: string }

    // Atomic revoke: only succeeds if the token exists and hasn't been revoked yet
    const stored = await RefreshToken.findOneAndUpdate(
      { jti, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    )
    if (!stored) {
      // Could be already-revoked (token reuse attack) or never existed
      const existing = await RefreshToken.findOne({ jti })
      if (existing?.revokedAt) {
        // Revoked token reused — possible theft, invalidate all sessions for this user
        await RefreshToken.updateMany(
          { userId: existing.userId, revokedAt: { $exists: false } },
          { revokedAt: new Date() },
        )
      }
      res.status(401).json({ message: 'Invalid or revoked token' })
      return
    }

    const user = await User.findById(userId)
    if (!user) {
      res.status(401).json({ message: 'Invalid token' })
      return
    }

    const { accessToken, refreshToken: newRefreshToken, refreshJti: newJti } = issueTokenPair(user._id.toString(), user.role)
    await RefreshToken.create({
      jti: newJti,
      userId: user._id,
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
    })

    res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions())
    res.cookie(REFRESH_COOKIE, newRefreshToken, refreshCookieOptions())
    logger.info({ event: 'auth.refresh.success', userId }, 'Token refreshed')
    res.json({ message: 'Token refreshed' })
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined

  if (token) {
    try {
      const raw = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as unknown
      if (
        typeof raw === 'object' && raw !== null &&
        'jti' in raw &&
        typeof (raw as Record<string, unknown>).jti === 'string'
      ) {
        const { jti, id: userId } = raw as { jti: string; id?: string }
        await RefreshToken.findOneAndUpdate(
          { jti },
          { revokedAt: new Date() },
        )
        if (userId) logger.info({ event: 'auth.logout', userId }, 'User logged out')
      }
    } catch {
      // Best-effort revocation — always clear cookies
    }
  }

  res.clearCookie(ACCESS_COOKIE, accessCookieOptions())
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
  res.json({ message: 'Logged out' })
}

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const { name, email, password, maxHR = 190 } = req.body as {
    name?: string
    email?: string
    password?: string
    maxHR?: number
  }

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email and password required' })
    return
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ message: 'Password too long' })
    return
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ message: 'Password must be at least 8 characters' })
    return
  }

  const normalisedEmail = email.trim().toLowerCase()

  if (!EMAIL_REGEX.test(normalisedEmail)) {
    res.status(400).json({ message: 'Invalid email format' })
    return
  }

  try {
    const existing = await User.findOne({ email: normalisedEmail })
    if (existing) {
      res.status(409).json({ message: 'Email already in use' })
      return
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await User.create({ name, email: normalisedEmail, passwordHash, role: 'member', maxHR })
    logger.info({ event: 'auth.register.success', userId: user._id.toString(), email: normalisedEmail, role: 'member' }, 'User registered')

    res.status(201).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        maxHR: user.maxHR,
      },
    })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user?.id).select('name email role maxHR')
    if (!user) {
      res.status(401).json({ message: 'User not found' })
      return
    }
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        maxHR: user.maxHR,
      },
    })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}
