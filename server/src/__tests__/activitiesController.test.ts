import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { uploadActivity } from '../controllers/activitiesController'

const mockCreate = jest.fn()
jest.mock('../models/Activity', () => ({ Activity: { create: (...args: unknown[]) => mockCreate(...args) } }))

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
    ...overrides,
  } as AuthRequest
}

function makeRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

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
