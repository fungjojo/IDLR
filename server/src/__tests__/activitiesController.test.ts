import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import {
  uploadActivity,
  getActivities,
  getActivity,
  deleteActivity,
} from '../controllers/activitiesController'

const mockCreate = jest.fn()
const mockFind = jest.fn()
const mockFindById = jest.fn()
const mockCountDocuments = jest.fn()

jest.mock('../models/Activity', () => ({
  Activity: {
    create: (...args: unknown[]) => mockCreate(...args),
    find: (...args: unknown[]) => mockFind(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
  },
}))

const mockParseFit = jest.fn()
const mockParseGpx = jest.fn()
jest.mock('../services/fitParser', () => ({ parseFitBuffer: (...args: unknown[]) => mockParseFit(...args) }))
jest.mock('../services/gpxParser', () => ({ parseGpxBuffer: (...args: unknown[]) => mockParseGpx(...args) }))

const ACTIVITY_DATA = {
  name: 'Morning Run',
  date: new Date('2024-03-01'),
  distanceMeters: 5000,
  durationSeconds: 1800,
  avgHR: 145,
  maxHR: 175,
  hrStream: [140, 145, 150],
  paceStream: [333, 312, 322],
}

const MOCK_ACTIVITY_DOC = {
  _id: 'act-1',
  userId: { toString: () => 'user123' },
  ...ACTIVITY_DATA,
  deleteOne: jest.fn().mockResolvedValue({}),
}

function makeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    user: { id: 'user123', email: 'test@test.com', role: 'member' },
    file: {
      fieldname: 'file',
      originalname: 'run.gpx',
      mimetype: 'application/gpx+xml',
      buffer: Buffer.from('<gpx/>'),
      size: 10,
    } as Express.Multer.File,
    query: {},
    params: {},
    ...overrides,
  } as AuthRequest
}

function makeRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

// ── uploadActivity (existing) ──────────────────────────────────────────────

describe('uploadActivity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when no file provided', async () => {
    const req = makeReq({ file: undefined })
    const res = makeRes()
    await uploadActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'No file provided' })
  })

  it('returns 400 for unsupported file extension', async () => {
    const req = makeReq({ file: { originalname: 'data.csv' } as Express.Multer.File })
    const res = makeRes()
    await uploadActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('fit') }))
  })

  it('calls parseGpxBuffer for .gpx files and saves activity', async () => {
    mockParseGpx.mockReturnValue(ACTIVITY_DATA)
    mockCreate.mockResolvedValue({ _id: 'act1', ...ACTIVITY_DATA })
    const req = makeReq()
    const res = makeRes()
    await uploadActivity(req, res)
    expect(mockParseGpx).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ source: 'manual', userId: 'user123' }))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('calls parseFitBuffer for .fit files', async () => {
    mockParseFit.mockResolvedValue(ACTIVITY_DATA)
    mockCreate.mockResolvedValue({ _id: 'act1', ...ACTIVITY_DATA })
    const req = makeReq({ file: { originalname: 'run.fit', buffer: Buffer.from('') } as Express.Multer.File })
    const res = makeRes()
    await uploadActivity(req, res)
    expect(mockParseFit).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('returns 422 when parser throws', async () => {
    mockParseGpx.mockImplementation(() => { throw new Error('parse error') })
    const req = makeReq()
    const res = makeRes()
    await uploadActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(422)
  })

  it('returns 500 when Activity.create throws', async () => {
    mockParseGpx.mockReturnValue(ACTIVITY_DATA)
    mockCreate.mockRejectedValue(new Error('db error'))
    const req = makeReq()
    const res = makeRes()
    await uploadActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

// ── getActivities ──────────────────────────────────────────────────────────

describe('getActivities', () => {
  beforeEach(() => jest.clearAllMocks())

  function makeChain(result: unknown[]) {
    return {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(result),
    }
  }

  it('returns paginated activities for the current user', async () => {
    mockFind.mockReturnValue(makeChain([MOCK_ACTIVITY_DOC]))
    mockCountDocuments.mockResolvedValue(1)
    const req = makeReq({ query: { page: '1', limit: '10' } })
    const res = makeRes()
    await getActivities(req, res)
    expect(mockFind).toHaveBeenCalledWith({ userId: 'user123' })
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      activities: [MOCK_ACTIVITY_DOC],
      total: 1,
      page: 1,
      pages: 1,
    }))
  })

  it('defaults to page 1 and limit 10 when query params are missing', async () => {
    mockFind.mockReturnValue(makeChain([]))
    mockCountDocuments.mockResolvedValue(0)
    const req = makeReq({ query: {} })
    const res = makeRes()
    await getActivities(req, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pages: 0 }))
  })

  it('falls back to page 1 and limit 10 when params are non-numeric', async () => {
    mockFind.mockReturnValue(makeChain([]))
    mockCountDocuments.mockResolvedValue(0)
    const req = makeReq({ query: { page: 'abc', limit: 'xyz' } })
    const res = makeRes()
    await getActivities(req, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }))
  })

  it('returns 500 on database error', async () => {
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValue(new Error('db error')),
    })
    mockCountDocuments.mockResolvedValue(0)
    const req = makeReq({ query: {} })
    const res = makeRes()
    await getActivities(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

// ── getActivity ────────────────────────────────────────────────────────────

describe('getActivity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the activity when found and owned by user', async () => {
    mockFindById.mockResolvedValue(MOCK_ACTIVITY_DOC)
    const req = makeReq({ params: { id: 'act-1' } })
    const res = makeRes()
    await getActivity(req, res)
    expect(res.json).toHaveBeenCalledWith(MOCK_ACTIVITY_DOC)
  })

  it('returns 404 when activity does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    const req = makeReq({ params: { id: 'bad-id' } })
    const res = makeRes()
    await getActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 404 when activity belongs to another user', async () => {
    mockFindById.mockResolvedValue({
      ...MOCK_ACTIVITY_DOC,
      userId: { toString: () => 'other-user' },
    })
    const req = makeReq({ params: { id: 'act-1' } })
    const res = makeRes()
    await getActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

// ── deleteActivity ─────────────────────────────────────────────────────────

describe('deleteActivity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('deletes the activity and returns 204', async () => {
    const mockDoc = { ...MOCK_ACTIVITY_DOC, deleteOne: jest.fn().mockResolvedValue({}) }
    mockFindById.mockResolvedValue(mockDoc)
    const req = makeReq({ params: { id: 'act-1' } })
    const res = makeRes()
    await deleteActivity(req, res)
    expect(mockDoc.deleteOne).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })

  it('returns 404 when activity does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    const req = makeReq({ params: { id: 'bad-id' } })
    const res = makeRes()
    await deleteActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 404 when activity belongs to another user', async () => {
    mockFindById.mockResolvedValue({
      ...MOCK_ACTIVITY_DOC,
      userId: { toString: () => 'other-user' },
      deleteOne: jest.fn(),
    })
    const req = makeReq({ params: { id: 'act-1' } })
    const res = makeRes()
    await deleteActivity(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
