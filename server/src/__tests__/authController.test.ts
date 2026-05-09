import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { login, logout, refresh, register } from '../controllers/authController'
import { User } from '../models/User'
import { RefreshToken } from '../models/RefreshToken'
import type { AuthRequest } from '../middleware/auth'

jest.mock('../models/User')
jest.mock('../models/RefreshToken')
jest.mock('bcryptjs')
jest.mock('jsonwebtoken')

const JWT_SECRET = 'test-secret-at-least-32-characters-long'
const REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars'

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET
  process.env.REFRESH_TOKEN_SECRET = REFRESH_SECRET
})

afterAll(() => {
  delete process.env.JWT_SECRET
  delete process.env.REFRESH_TOKEN_SECRET
})

const mockUser = {
  _id: { toString: () => 'user-id-1' },
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  role: 'member' as const,
  maxHR: 185,
}

function mockRes() {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.cookie = jest.fn().mockReturnValue(res)
  res.clearCookie = jest.fn().mockReturnValue(res)
  return res
}

describe('login', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when email is missing', async () => {
    const req = { body: { password: 'pw' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Email and password required' })
  })

  it('returns 400 when password is missing', async () => {
    const req = { body: { email: 'a@b.com' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 401 when user is not found', async () => {
    ;(User.findOne as jest.Mock).mockResolvedValue(null)
    const req = { body: { email: 'no@one.com', password: 'pw' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' })
  })

  it('returns 401 when password is wrong', async () => {
    ;(User.findOne as jest.Mock).mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    const req = { body: { email: 'test@example.com', password: 'wrong' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' })
  })

  it('sets both httpOnly cookies and returns user on valid credentials', async () => {
    ;(User.findOne as jest.Mock).mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    ;(jwt.sign as jest.Mock).mockReturnValue('test-token')
    ;(RefreshToken.create as jest.Mock).mockResolvedValue({})
    const req = { body: { email: 'test@example.com', password: 'correct' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(res.cookie).toHaveBeenCalledWith('idlr_token', 'test-token', expect.objectContaining({ httpOnly: true }))
    expect(res.cookie).toHaveBeenCalledWith('idlr_refresh', 'test-token', expect.objectContaining({ httpOnly: true }))
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'user-id-1', name: 'Test User', email: 'test@example.com', role: 'member', maxHR: 185 },
    })
  })

  it('stores refresh token in DB on successful login', async () => {
    ;(User.findOne as jest.Mock).mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    ;(jwt.sign as jest.Mock).mockReturnValue('test-token')
    ;(RefreshToken.create as jest.Mock).mockResolvedValue({})
    const req = { body: { email: 'test@example.com', password: 'correct' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(RefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ jti: expect.any(String), expiresAt: expect.any(Date) }),
    )
  })

  it('sets secure:true and sameSite:strict in production', async () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    ;(User.findOne as jest.Mock).mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    ;(jwt.sign as jest.Mock).mockReturnValue('test-token')
    ;(RefreshToken.create as jest.Mock).mockResolvedValue({})
    const req = { body: { email: 'test@example.com', password: 'correct' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(res.cookie).toHaveBeenCalledWith('idlr_token', 'test-token', expect.objectContaining({ secure: true, sameSite: 'strict' }))
    process.env.NODE_ENV = original
  })

  it('sets secure:false and sameSite:lax in development', async () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    ;(User.findOne as jest.Mock).mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    ;(jwt.sign as jest.Mock).mockReturnValue('test-token')
    ;(RefreshToken.create as jest.Mock).mockResolvedValue({})
    const req = { body: { email: 'test@example.com', password: 'correct' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(res.cookie).toHaveBeenCalledWith('idlr_token', 'test-token', expect.objectContaining({ secure: false, sameSite: 'lax' }))
    process.env.NODE_ENV = original
  })

  it('returns 500 on unexpected error', async () => {
    ;(User.findOne as jest.Mock).mockRejectedValue(new Error('DB error'))
    const req = { body: { email: 'a@b.com', password: 'pw' } } as Request
    const res = mockRes()
    await login(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('refresh', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no refresh cookie is present', async () => {
    const req = { cookies: {} } as unknown as Request
    const res = mockRes()
    await refresh(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 401 when refresh token is invalid', async () => {
    ;(jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('bad') })
    const req = { cookies: { idlr_refresh: 'bad-token' } } as unknown as Request
    const res = mockRes()
    await refresh(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 401 when token is not found in DB', async () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ id: 'user-id-1', jti: 'some-jti' })
    ;(RefreshToken.findOneAndUpdate as jest.Mock).mockResolvedValue(null)
    ;(RefreshToken.findOne as jest.Mock).mockResolvedValue(null)
    const req = { cookies: { idlr_refresh: 'valid-token' } } as unknown as Request
    const res = mockRes()
    await refresh(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or revoked token' })
  })

  it('returns 401 when token is revoked and revokes all user sessions', async () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ id: 'user-id-1', jti: 'some-jti' })
    ;(RefreshToken.findOneAndUpdate as jest.Mock).mockResolvedValue(null)
    ;(RefreshToken.findOne as jest.Mock).mockResolvedValue({
      jti: 'some-jti',
      revokedAt: new Date(),
      userId: 'user-id-1',
    })
    ;(RefreshToken.updateMany as jest.Mock).mockResolvedValue({})
    const req = { cookies: { idlr_refresh: 'revoked-token' } } as unknown as Request
    const res = mockRes()
    await refresh(req, res)
    expect(RefreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: { $exists: false } }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    )
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or revoked token' })
  })

  it('returns 401 when user no longer exists', async () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ id: 'user-id-1', jti: 'some-jti' })
    ;(RefreshToken.findOneAndUpdate as jest.Mock).mockResolvedValue({ jti: 'some-jti' })
    ;(User.findById as jest.Mock).mockResolvedValue(null)
    const req = { cookies: { idlr_refresh: 'valid-token' } } as unknown as Request
    const res = mockRes()
    await refresh(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rotates tokens and sets new cookies on valid refresh', async () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ id: 'user-id-1', jti: 'old-jti' })
    ;(RefreshToken.findOneAndUpdate as jest.Mock).mockResolvedValue({ jti: 'old-jti' })
    ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
    ;(jwt.sign as jest.Mock).mockReturnValue('new-token')
    ;(RefreshToken.create as jest.Mock).mockResolvedValue({})
    const req = { cookies: { idlr_refresh: 'valid-token' } } as unknown as Request
    const res = mockRes()
    await refresh(req, res)
    expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ jti: 'old-jti', revokedAt: { $exists: false } }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    )
    expect(res.cookie).toHaveBeenCalledWith('idlr_token', 'new-token', expect.objectContaining({ httpOnly: true }))
    expect(res.cookie).toHaveBeenCalledWith('idlr_refresh', 'new-token', expect.objectContaining({ httpOnly: true }))
    expect(res.json).toHaveBeenCalledWith({ message: 'Token refreshed' })
  })
})

describe('logout', () => {
  beforeEach(() => jest.clearAllMocks())

  it('clears both cookies when no refresh token is present', async () => {
    const req = { cookies: {} } as unknown as Request
    const res = mockRes()
    await logout(req, res)
    expect(res.clearCookie).toHaveBeenCalledWith('idlr_token', expect.objectContaining({ httpOnly: true }))
    expect(res.clearCookie).toHaveBeenCalledWith('idlr_refresh', expect.objectContaining({ httpOnly: true }))
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out' })
  })

  it('revokes refresh token in DB and clears both cookies', async () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ id: 'user-id-1', jti: 'some-jti' })
    ;(RefreshToken.findOneAndUpdate as jest.Mock).mockResolvedValue({})
    const req = { cookies: { idlr_refresh: 'valid-refresh-token' } } as unknown as Request
    const res = mockRes()
    await logout(req, res)
    expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith({ jti: 'some-jti' }, { revokedAt: expect.any(Date) })
    expect(res.clearCookie).toHaveBeenCalledWith('idlr_token', expect.objectContaining({ httpOnly: true }))
    expect(res.clearCookie).toHaveBeenCalledWith('idlr_refresh', expect.objectContaining({ httpOnly: true }))
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out' })
  })

  it('still clears cookies even if refresh token is invalid', async () => {
    ;(jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('expired') })
    const req = { cookies: { idlr_refresh: 'expired-token' } } as unknown as Request
    const res = mockRes()
    await logout(req, res)
    expect(res.clearCookie).toHaveBeenCalledWith('idlr_token', expect.anything())
    expect(res.clearCookie).toHaveBeenCalledWith('idlr_refresh', expect.anything())
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out' })
  })
})

describe('register', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when fields are missing', async () => {
    const req = { body: { email: 'a@b.com' }, user: { id: 'admin', role: 'admin' as const } } as AuthRequest
    const res = mockRes()
    await register(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Name, email and password required' })
  })

  it('returns 400 when password is shorter than 8 characters', async () => {
    const req = {
      body: { name: 'New', email: 'new@example.com', password: 'short' },
      user: { id: 'admin', role: 'admin' as const },
    } as AuthRequest
    const res = mockRes()
    await register(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Password must be at least 8 characters' })
  })

  it('returns 409 when email is already in use', async () => {
    ;(User.findOne as jest.Mock).mockResolvedValue(mockUser)
    const req = {
      body: { name: 'New', email: 'test@example.com', password: 'validpassword' },
      user: { id: 'admin', role: 'admin' as const },
    } as AuthRequest
    const res = mockRes()
    await register(req, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ message: 'Email already in use' })
  })

  it('creates user and returns 201 on valid data', async () => {
    ;(User.findOne as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw')
    ;(User.create as jest.Mock).mockResolvedValue({
      ...mockUser,
      _id: { toString: () => 'new-id' },
      name: 'New User',
      email: 'new@example.com',
    })
    const req = {
      body: { name: 'New User', email: 'new@example.com', password: 'validpassword' },
      user: { id: 'admin', role: 'admin' as const },
    } as AuthRequest
    const res = mockRes()
    await register(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('returns 500 on unexpected error', async () => {
    ;(User.findOne as jest.Mock).mockRejectedValue(new Error('DB error'))
    const req = {
      body: { name: 'A', email: 'a@b.com', password: 'validpassword' },
      user: { id: 'admin', role: 'admin' as const },
    } as AuthRequest
    const res = mockRes()
    await register(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
