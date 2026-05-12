import type { Request, Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { stravaConnect, stravaCallback, stravaSync } from '../controllers/stravaController'

const mockFindById = jest.fn()
const mockFindByIdAndUpdate = jest.fn()
const mockActivityFind = jest.fn()
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
    find: (...args: unknown[]) => mockActivityFind(...args),
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
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }
  return res as unknown as Response
}

function makeReq(overrides = {}): AuthRequest {
  return {
    user: { id: 'user1', email: 'u@u.com', role: 'member' },
    query: {},
    cookies: {},
    ...overrides,
  } as unknown as AuthRequest
}

describe('stravaConnect', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV, STRAVA_CLIENT_ID: 'cid', STRAVA_REDIRECT_URI: 'http://localhost/cb' }
  })
  afterEach(() => { process.env = OLD_ENV })

  it('redirects to Strava auth URL with state param', () => {
    const res = makeRes()
    stravaConnect({} as Request, res)
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava.com/oauth/authorize'))
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('client_id=cid'))
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('state='))
  })

  it('sets strava_state cookie before redirecting', () => {
    const res = makeRes()
    stravaConnect({} as Request, res)
    expect(res.cookie).toHaveBeenCalledWith('strava_state', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax' }))
  })

  it('state in cookie matches state in redirect URL', () => {
    const res = makeRes()
    stravaConnect({} as Request, res)
    const cookieState = (res.cookie as jest.Mock).mock.calls[0][1] as string
    const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0] as string
    expect(redirectUrl).toContain(`state=${cookieState}`)
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
    const req = makeReq({ query: { code: 'auth_code', state: 'abc123' }, cookies: { strava_state: 'abc123' } })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(mockExchangeCode).toHaveBeenCalledWith('auth_code')
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava=connected'))
  })

  it('clears the state cookie on success', async () => {
    mockExchangeCode.mockResolvedValue({ access_token: 'at', refresh_token: 'rt', expires_at: 9999 })
    mockFindByIdAndUpdate.mockResolvedValue(null)
    const req = makeReq({ query: { code: 'c', state: 'xyz' }, cookies: { strava_state: 'xyz' } })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(res.clearCookie).toHaveBeenCalledWith('strava_state')
  })

  it('redirects with denied when state is missing from query', async () => {
    const req = makeReq({ query: { code: 'c' }, cookies: { strava_state: 'abc' } })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava=denied'))
  })

  it('redirects with denied when state does not match cookie', async () => {
    const req = makeReq({ query: { code: 'c', state: 'wrong' }, cookies: { strava_state: 'correct' } })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava=denied'))
  })

  it('redirects with denied when cookie is missing', async () => {
    const req = makeReq({ query: { code: 'c', state: 'abc' }, cookies: {} })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava=denied'))
  })

  it('redirects with denied when Strava sends error param', async () => {
    const req = makeReq({ query: { error: 'access_denied' }, cookies: {} })
    const res = makeRes()
    await stravaCallback(req, res)
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava=denied'))
  })

  it('redirects with error when exchange throws', async () => {
    mockExchangeCode.mockRejectedValue(new Error('network'))
    const req = makeReq({ query: { code: 'c', state: 'abc' }, cookies: { strava_state: 'abc' } })
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

  it('returns 500 when User.findById throws', async () => {
    mockFindById.mockRejectedValue(new Error('db error'))
    const res = makeRes()
    await stravaSync(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

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

  it('batch-checks duplicates and creates only new activities', async () => {
    mockFindById.mockResolvedValue(userStub)
    mockRefreshToken.mockResolvedValue('access_token')
    mockActivityFindOne.mockReturnValue({ sort: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue(null) })
    mockFetchActivities.mockResolvedValue([rawActivity, { ...rawActivity, id: 2 }])
    // Activity.find returns the existing one (id: 2)
    mockActivityFind.mockResolvedValue([{ stravaActivityId: 2 }])
    mockFetchStreams.mockResolvedValue({ hrStream: [140], paceStream: [333] })
    mockActivityCreate.mockResolvedValue({})
    const res = makeRes()
    await stravaSync(makeReq(), res)
    // Should call Activity.find once (batch), not Activity.exists twice
    expect(mockActivityFind).toHaveBeenCalledTimes(1)
    expect(mockActivityCreate).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created: 1, skipped: 1 }))
  })

  it('skips activity if stream fetch throws', async () => {
    mockFindById.mockResolvedValue(userStub)
    mockRefreshToken.mockResolvedValue('access_token')
    mockActivityFindOne.mockReturnValue({ sort: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue(null) })
    mockFetchActivities.mockResolvedValue([rawActivity])
    mockActivityFind.mockResolvedValue([])
    mockFetchStreams.mockRejectedValue(new Error('stream error'))
    const res = makeRes()
    await stravaSync(makeReq(), res)
    expect(mockActivityCreate).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ skipped: 1 }))
  })
})
