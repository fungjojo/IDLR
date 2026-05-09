import type { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'
import { User } from '../models/User'

jest.mock('jsonwebtoken')
jest.mock('../models/User')

beforeAll(() => { process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long' })
afterAll(() => { delete process.env.JWT_SECRET })

function mockRes() {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('requireAuth', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no cookie is present', () => {
    const req = { cookies: {} } as unknown as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when cookie is present but token is invalid', () => {
    ;(jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('bad token') })
    const req = { cookies: { idlr_token: 'bad-token' } } as unknown as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next and sets req.user on valid cookie', () => {
    const payload = { id: 'user-1', role: 'member' as const }
    ;(jwt.verify as jest.Mock).mockReturnValue(payload)
    const req = { cookies: { idlr_token: 'valid-token' } } as unknown as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    requireAuth(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user).toEqual(payload)
  })

  it('verifies token with HS256 algorithm', () => {
    const payload = { id: 'user-1', role: 'member' as const }
    ;(jwt.verify as jest.Mock).mockReturnValue(payload)
    const req = { cookies: { idlr_token: 'valid-token' } } as unknown as AuthRequest
    requireAuth(req, mockRes(), jest.fn() as NextFunction)
    expect(jwt.verify).toHaveBeenCalledWith(
      'valid-token',
      expect.any(String),
      expect.objectContaining({ algorithms: ['HS256'], issuer: 'idlr', audience: 'idlr-client' }),
    )
  })
})

function mockFindById(role: string | null) {
  ;(User.findById as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(role !== null ? { role } : null),
  })
}

describe('adminOnly', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 403 without DB call when req.user is not set', async () => {
    const req = {} as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    await adminOnly(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(User.findById).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 without DB call when JWT role is member', async () => {
    const req = { user: { id: '1', role: 'member' as const } } as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    await adminOnly(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(User.findById).not.toHaveBeenCalled()
  })

  it('returns 403 when JWT says admin but DB role is member', async () => {
    mockFindById('member')
    const req = { user: { id: '1', role: 'admin' as const } } as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    await adminOnly(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next when JWT role is admin and DB confirms', async () => {
    mockFindById('admin')
    const req = { user: { id: '1', role: 'admin' as const } } as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    await adminOnly(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 500 on DB error', async () => {
    ;(User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const req = { user: { id: '1', role: 'admin' as const } } as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    await adminOnly(req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(next).not.toHaveBeenCalled()
  })
})
