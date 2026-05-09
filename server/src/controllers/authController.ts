import { randomUUID } from 'crypto'
import { type Request, type Response, type CookieOptions } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { RefreshToken } from '../models/RefreshToken'
import { type AuthRequest } from '../middleware/auth'

const BCRYPT_ROUNDS = 12
const MAX_PASSWORD_LENGTH = 72
const MIN_PASSWORD_LENGTH = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }

    const userId = user._id.toString()
    const { accessToken, refreshToken, refreshJti } = issueTokenPair(userId, user.role)

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
    console.error(err)
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

    const stored = await RefreshToken.findOne({ jti })
    if (!stored || stored.revokedAt) {
      res.status(401).json({ message: 'Invalid or revoked token' })
      return
    }

    const user = await User.findById(userId)
    if (!user) {
      res.status(401).json({ message: 'Invalid token' })
      return
    }

    await RefreshToken.findOneAndUpdate({ jti }, { revokedAt: new Date() })

    const { accessToken, refreshToken: newRefreshToken, refreshJti: newJti } = issueTokenPair(user._id.toString(), user.role)
    await RefreshToken.create({
      jti: newJti,
      userId: user._id,
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
    })

    res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions())
    res.cookie(REFRESH_COOKIE, newRefreshToken, refreshCookieOptions())
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
        await RefreshToken.findOneAndUpdate(
          { jti: (raw as { jti: string }).jti },
          { revokedAt: new Date() },
        )
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
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}
