import type { Request, Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { stravaConnect, stravaCallback, stravaSync } from '../controllers/stravaController'

const mockFindById = jest.fn()
const mockFindByIdAndUpdate = jest.fn()
const mockExists = jest.fn()
const mockActivityCreate = jest.fn()
const mockActivityFindOne = jest.fn()
jest.mock('../models/User', () => ({
  User: {
    findById: (...args: unknown[]) => mockFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockFindByIdAndUpdate(...args),
  },
}))
jest.mock('../models/Activity', () => ({
  Activity: {
    exists: (...args: unknown[]) => mockExists(...args),
    create: (...args: unknown[]) => mockActivityCreate(...args),
    findOne: (...args: unknown[]) => mockActivityFindOne(...args),
  },
}))

const mockExchangeCode = jest.fn()
const mockRefreshToken = jest.fn()
const mockFetchActivities = jest.fn()
const mockFetchStreams = jest.fn()
jest.mock('../services/stravaService', () => ({
  exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
  refreshAccessToken: (...args: unknown[]) => mockRefreshToken(...args),
  fetchActivities: (...args: unknown[]) => mockFetchActivities(...args),
  fetchActivityStreams: (...args: unknown[]) => mockFetchStreams(...args),
  normaliseActivity: jest.requireActual('../services/stravaService').normaliseActivity,
}))

function makeRes() {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), redirect: jest.fn() }
  return res as unknown as Response
}

function makeReq(overrides = {}): AuthRequest {
  return { user: { id: 'user1', email: 'u@u.com', role: 'member' }, query: {}, ...overrides } as unknown as AuthRequest
}

describe('stravaConnect', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV, STRAVA_CLIENT_ID: 'cid', STRAVA_REDIRECT_URI: 'http://localhost/cb' }
  })
  afterEach(() => { process.env = OLD_ENV })

  it('redirects to Strava auth URL', () => {
    const res = makeRes()
    stravaConnect({} as Request, res)
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava.com/oauth/authorize'))
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('client_id=cid'))
  })

  it('returns 503 when env vars are missing', () => {
    process.env = { ...OLD_ENV }
    delete process.env.STRAVA_CLIENT_ID
    const res = makeRes()
    stravaConnect({} as Request, res)
    expect(res.status).toHaveBeenCalledWith(503)
  })
})

describe('stravaCallback', () => {
  beforeEach(() => jest.clearAllMocks())

  it('exchanges code and redirects to profile on success', async () => {
    mockExchangeCode.mockResolvedValue({ access_token: 'at', refresh_token: 'rt', expires_at: 9999, athlete: { id: 42 } })
    mockFindByIdAndUpdate.mockResolvedValue(null)
    const req = makeReq({ query: { code: 'auth_code' } })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(mockExchangeCode).toHaveBeenCalledWith('auth_code')
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava=connected'))
  })

  it('redirects with denied when error query param is present', async () => {
    const req = makeReq({ query: { error: 'access_denied' } })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava=denied'))
  })

  it('redirects with error when exchange throws', async () => {
    mockExchangeCode.mockRejectedValue(new Error('network'))
    const req = makeReq({ query: { code: 'bad_code' } })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava=error'))
  })
})

describe('stravaSync', () => {
  beforeEach(() => jest.clearAllMocks())

  const userStub = { _id: 'user1', stravaRefreshToken: 'rt' }
  const rawActivity = {
    id: 1,
    name: 'Run',
    start_date: '2024-01-01T08:00:00Z',
    distance: 5000,
    elapsed_time: 1800,
    average_heartrate: 145,
    max_heartrate: 175,
  }

  it('returns 400 when Strava is not connected', async () => {
    mockFindById.mockResolvedValue({ stravaRefreshToken: undefined })
    const res = makeRes()
    await stravaSync(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 502 when token refresh fails', async () => {
    mockFindById.mockResolvedValue(userStub)
    mockRefreshToken.mockRejectedValue(new Error('refresh failed'))
    const res = makeRes()
    await stravaSync(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(502)
  })

  it('creates new activities and skips existing ones', async () => {
    mockFindById.mockResolvedValue(userStub)
    mockRefreshToken.mockResolvedValue('access_token')
    mockActivityFindOne.mockReturnValue({ sort: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue(null) })
    mockFetchActivities.mockResolvedValue([rawActivity, { ...rawActivity, id: 2 }])
    mockExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    mockFetchStreams.mockResolvedValue({ hrStream: [140], paceStream: [333] })
    mockActivityCreate.mockResolvedValue({})
    const res = makeRes()
    await stravaSync(makeReq(), res)
    expect(mockActivityCreate).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created: 1, skipped: 1 }))
  })

  it('skips activity if stream fetch throws', async () => {
    mockFindById.mockResolvedValue(userStub)
    mockRefreshToken.mockResolvedValue('access_token')
    mockActivityFindOne.mockReturnValue({ sort: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue(null) })
    mockFetchActivities.mockResolvedValue([rawActivity])
    mockExists.mockResolvedValue(false)
    mockFetchStreams.mockRejectedValue(new Error('stream error'))
    const res = makeRes()
    await stravaSync(makeReq(), res)
    expect(mockActivityCreate).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ skipped: 1 }))
  })
})
