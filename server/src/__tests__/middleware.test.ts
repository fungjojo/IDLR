import type { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'

jest.mock('jsonwebtoken')

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
      expect.objectContaining({ algorithms: ['HS256'] }),
    )
  })
})

describe('adminOnly', () => {
  it('returns 403 when req.user is not set', () => {
    const req = {} as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    adminOnly(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when role is member', () => {
    const req = { user: { id: '1', role: 'member' as const } } as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    adminOnly(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('calls next when role is admin', () => {
    const req = { user: { id: '1', role: 'admin' as const } } as AuthRequest
    const res = mockRes()
    const next = jest.fn() as NextFunction
    adminOnly(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
})
