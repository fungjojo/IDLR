import type { Response, NextFunction } from 'express'
import { idempotency } from '../middleware/idempotency'
import { IdempotencyKey } from '../models/IdempotencyKey'
import type { AuthRequest } from '../middleware/auth'

jest.mock('../models/IdempotencyKey')
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

function mockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: {},
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

  it('calls next() and skips cache when no Idempotency-Key header is present', async () => {
    const req = mockReq({ headers: {} })
    const res = mockRes()
    const next = jest.fn() as NextFunction

    await idempotency(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(IdempotencyKey.findOne).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('returns cached response when key has been seen before (cache hit)', async () => {
    const cached = { statusCode: 201, body: JSON.stringify({ message: 'ok' }) }
    ;(IdempotencyKey.findOne as jest.Mock).mockResolvedValue(cached)

    const req = mockReq({ headers: { 'idempotency-key': 'key-abc' } })
    const res = mockRes()
    const next = jest.fn() as NextFunction

    await idempotency(req, res, next)

    expect(IdempotencyKey.findOne).toHaveBeenCalledWith({ key: 'key-abc', userId: 'user-id-1' })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ message: 'ok' })
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() and wraps res.json to store the response on cache miss', async () => {
    ;(IdempotencyKey.findOne as jest.Mock).mockResolvedValue(null)
    ;(IdempotencyKey.create as jest.Mock).mockResolvedValue({})

    const req = mockReq({ headers: { 'idempotency-key': 'key-xyz' } })
    const res = mockRes()
    const next = jest.fn() as NextFunction

    await idempotency(req, res, next)

    expect(next).toHaveBeenCalled()

    // Simulate the handler calling res.json
    res.statusCode = 201
    res.json({ id: 'new-resource' })

    expect(IdempotencyKey.create).toHaveBeenCalledWith({
      key: 'key-xyz',
      userId: 'user-id-1',
      statusCode: 201,
      body: JSON.stringify({ id: 'new-resource' }),
    })
  })

  it('still calls next() even if IdempotencyKey.create throws', async () => {
    ;(IdempotencyKey.findOne as jest.Mock).mockResolvedValue(null)
    ;(IdempotencyKey.create as jest.Mock).mockRejectedValue(new Error('DB error'))

    const req = mockReq({ headers: { 'idempotency-key': 'key-xyz' } })
    const res = mockRes()
    const next = jest.fn() as NextFunction

    await idempotency(req, res, next)
    expect(next).toHaveBeenCalled()

    // Simulate handler completing — should not throw even if create fails
    await expect(async () => { res.json({ id: 'new-resource' }) }).not.toThrow()
  })
})
