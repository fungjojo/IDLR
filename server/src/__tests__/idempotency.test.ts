import type { Response, NextFunction } from 'express'
import { idempotency } from '../middleware/idempotency'
import { IdempotencyKey } from '../models/IdempotencyKey'
import type { AuthRequest } from '../middleware/auth'

jest.mock('../models/IdempotencyKey')
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

const VALID_KEY = '550e8400-e29b-41d4-a716-446655440001'

function mockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: { 'idempotency-key': VALID_KEY },
    user: { id: 'user-id-1', role: 'member' as const },
    ...overrides,
  } as AuthRequest
}

function mockRes(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.statusCode = 200
  return res
}

describe('idempotency middleware', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('header validation', () => {
    it('calls next() and skips cache when no Idempotency-Key header is present', async () => {
      const req = mockReq({ headers: {} })
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(IdempotencyKey.create).not.toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })

    it('returns 400 when Idempotency-Key is not a valid UUID v4', async () => {
      const req = mockReq({ headers: { 'idempotency-key': 'not-a-uuid' } })
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'Idempotency-Key must be a valid UUID v4' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 400 when Idempotency-Key exceeds max length', async () => {
      const req = mockReq({ headers: { 'idempotency-key': 'a'.repeat(37) } })
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next() and skips cache when req.user is not set', async () => {
      const req = mockReq({ user: undefined })
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(IdempotencyKey.create).not.toHaveBeenCalled()
    })
  })

  describe('cache miss (first request)', () => {
    it('inserts a placeholder, calls next(), and wraps res.json to store the response', async () => {
      const fakeRecord = { _id: 'record-id-1' }
      ;(IdempotencyKey.create as jest.Mock).mockResolvedValue(fakeRecord)
      ;(IdempotencyKey.updateOne as jest.Mock).mockResolvedValue({})

      const req = mockReq()
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)
      expect(next).toHaveBeenCalled()

      res.statusCode = 201
      res.json({ id: 'new-resource' })

      expect(IdempotencyKey.updateOne).toHaveBeenCalledWith(
        { _id: 'record-id-1' },
        { statusCode: 201, body: JSON.stringify({ id: 'new-resource' }) },
      )
    })

    it('deletes placeholder and does not store non-2xx responses', async () => {
      const fakeRecord = { _id: 'record-id-1' }
      ;(IdempotencyKey.create as jest.Mock).mockResolvedValue(fakeRecord)
      ;(IdempotencyKey.deleteOne as jest.Mock).mockResolvedValue({})

      const req = mockReq()
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      res.statusCode = 400
      res.json({ message: 'Bad request' })

      expect(IdempotencyKey.deleteOne).toHaveBeenCalledWith({ _id: 'record-id-1' })
      expect(IdempotencyKey.updateOne).not.toHaveBeenCalled()
    })

    it('forwards error to next() when create fails with a non-duplicate-key error', async () => {
      const dbErr = new Error('Connection timeout')
      ;(IdempotencyKey.create as jest.Mock).mockRejectedValue(dbErr)

      const req = mockReq()
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(next).toHaveBeenCalledWith(dbErr)
    })

    it('logs but does not crash when updateOne fails with a non-duplicate error', async () => {
      const fakeRecord = { _id: 'record-id-1' }
      ;(IdempotencyKey.create as jest.Mock).mockResolvedValue(fakeRecord)
      ;(IdempotencyKey.updateOne as jest.Mock).mockRejectedValue(new Error('Write failed'))

      const req = mockReq()
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)
      expect(next).toHaveBeenCalled()

      // Should not throw when handler calls res.json
      expect(() => { res.json({ id: 'new-resource' }) }).not.toThrow()
    })
  })

  describe('cache hit (duplicate request)', () => {
    it('returns cached response when key was previously completed', async () => {
      const dupErr = Object.assign(new Error('E11000'), { code: 11000 })
      ;(IdempotencyKey.create as jest.Mock).mockRejectedValue(dupErr)
      ;(IdempotencyKey.findOne as jest.Mock).mockResolvedValue({
        statusCode: 201,
        body: JSON.stringify({ message: 'ok' }),
      })

      const req = mockReq()
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ message: 'ok' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 409 when key exists but response is still pending (statusCode 0)', async () => {
      const dupErr = Object.assign(new Error('E11000'), { code: 11000 })
      ;(IdempotencyKey.create as jest.Mock).mockRejectedValue(dupErr)
      ;(IdempotencyKey.findOne as jest.Mock).mockResolvedValue({ statusCode: 0, body: '' })

      const req = mockReq()
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({ message: 'Request already in progress' })
    })

    it('returns 500 when cached body is corrupt JSON', async () => {
      const dupErr = Object.assign(new Error('E11000'), { code: 11000 })
      ;(IdempotencyKey.create as jest.Mock).mockRejectedValue(dupErr)
      ;(IdempotencyKey.findOne as jest.Mock).mockResolvedValue({
        statusCode: 201,
        body: 'not-valid-json{{{',
      })

      const req = mockReq()
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' })
    })

    it('forwards error to next() when findOne throws after E11000', async () => {
      const dupErr = Object.assign(new Error('E11000'), { code: 11000 })
      ;(IdempotencyKey.create as jest.Mock).mockRejectedValue(dupErr)
      const findErr = new Error('DB unreachable')
      ;(IdempotencyKey.findOne as jest.Mock).mockRejectedValue(findErr)

      const req = mockReq()
      const res = mockRes()
      const next = jest.fn() as NextFunction

      await idempotency(req, res, next)

      expect(next).toHaveBeenCalledWith(findErr)
    })
  })
})
