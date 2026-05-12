import { exchangeCode, refreshAccessToken, fetchActivities, fetchActivityStreams, normaliseActivity } from '../services/stravaService'

const mockFetch = jest.fn()
global.fetch = mockFetch

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response)
}

const TOKEN_RESPONSE = {
  access_token: 'new_access',
  refresh_token: 'new_refresh',
  expires_at: 9999999999,
  athlete: { id: 42 },
}

describe('exchangeCode', () => {
  beforeEach(() => jest.clearAllMocks())

  it('posts to token endpoint and returns tokens', async () => {
    mockFetch.mockReturnValue(jsonResponse(TOKEN_RESPONSE))
    const result = await exchangeCode('auth_code')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.access_token).toBe('new_access')
    expect(result.athlete?.id).toBe(42)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(jsonResponse({}, 400))
    await expect(exchangeCode('bad')).rejects.toThrow('400')
  })
})

describe('refreshAccessToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns existing token when not expired', async () => {
    const user = {
      stravaAccessToken: 'existing_token',
      stravaTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      save: jest.fn(),
    } as unknown as import('../models/User').IUser
    const token = await refreshAccessToken(user)
    expect(token).toBe('existing_token')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refreshes when token is expired', async () => {
    mockFetch.mockReturnValue(jsonResponse(TOKEN_RESPONSE))
    const user = {
      stravaAccessToken: 'old_token',
      stravaRefreshToken: 'refresh_token',
      stravaTokenExpiresAt: 0,
      save: jest.fn(),
    } as unknown as import('../models/User').IUser
    const token = await refreshAccessToken(user)
    expect(token).toBe('new_access')
    expect(user.save).toHaveBeenCalled()
  })

  it('throws on refresh failure', async () => {
    mockFetch.mockReturnValue(jsonResponse({}, 401))
    const user = {
      stravaRefreshToken: 'bad',
      stravaTokenExpiresAt: 0,
      save: jest.fn(),
    } as unknown as import('../models/User').IUser
    await expect(refreshAccessToken(user)).rejects.toThrow('401')
  })
})

describe('fetchActivities', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls activities endpoint with token', async () => {
    mockFetch.mockReturnValue(jsonResponse([{ id: 1, name: 'Run' }]))
    const result = await fetchActivities('token123')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/athlete/activities'),
      expect.objectContaining({ headers: { Authorization: 'Bearer token123' } }),
    )
    expect(result).toHaveLength(1)
  })

  it('appends after param when provided', async () => {
    mockFetch.mockReturnValue(jsonResponse([]))
    await fetchActivities('token', 1234567890)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('after=1234567890'),
      expect.anything(),
    )
  })

  it('paginates until a partial page is returned', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: 'Run' }))
    const page2 = [{ id: 51, name: 'Run' }]
    mockFetch
      .mockReturnValueOnce(jsonResponse(page1))
      .mockReturnValueOnce(jsonResponse(page2))
    const result = await fetchActivities('token')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(51)
  })

  it('stops after a single empty page', async () => {
    mockFetch.mockReturnValue(jsonResponse([]))
    const result = await fetchActivities('token')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(0)
  })
})

describe('fetchActivityStreams', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns parsed HR and pace streams', async () => {
    mockFetch.mockReturnValue(jsonResponse([
      { type: 'heartrate', data: [140, 150, 160] },
      { type: 'velocity_smooth', data: [3.0, 3.5, 4.0] },
    ]))
    const result = await fetchActivityStreams(99, 'token')
    expect(result.hrStream).toEqual([140, 150, 160])
    expect(result.paceStream[0]).toBeCloseTo(333.3, 0)
  })

  it('returns empty arrays when streams are missing', async () => {
    mockFetch.mockReturnValue(jsonResponse([]))
    const result = await fetchActivityStreams(99, 'token')
    expect(result.hrStream).toEqual([])
    expect(result.paceStream).toEqual([])
  })
})

describe('normaliseActivity', () => {
  const raw = {
    id: 1,
    name: 'Morning Run',
    start_date: '2024-03-01T08:00:00Z',
    distance: 5000,
    elapsed_time: 1800,
    average_heartrate: 145,
    max_heartrate: 175,
    average_cadence: 85,
    total_elevation_gain: 42,
  }

  it('maps Strava fields to ActivityData', () => {
    const result = normaliseActivity(raw, [140, 150], [333, 285])
    expect(result.name).toBe('Morning Run')
    expect(result.distanceMeters).toBe(5000)
    expect(result.durationSeconds).toBe(1800)
    expect(result.avgHR).toBe(145)
    expect(result.maxHR).toBe(175)
    expect(result.cadenceAvg).toBe(85)
    expect(result.elevationGainMeters).toBe(42)
    expect(result.hrStream).toEqual([140, 150])
  })

  it('falls back to computed HR when Strava summary is missing', () => {
    const noHR = { ...raw, average_heartrate: undefined, max_heartrate: undefined }
    const result = normaliseActivity(noHR, [140, 160], [])
    expect(result.avgHR).toBe(150)
    expect(result.maxHR).toBe(160)
  })

  it('handles large hrStream without stack overflow', () => {
    const largeStream = Array.from({ length: 15000 }, (_, i) => 130 + (i % 50))
    const noHR = { ...raw, average_heartrate: undefined, max_heartrate: undefined }
    expect(() => normaliseActivity(noHR, largeStream, [])).not.toThrow()
    const result = normaliseActivity(noHR, largeStream, [])
    expect(result.maxHR).toBe(179)
  })
})
