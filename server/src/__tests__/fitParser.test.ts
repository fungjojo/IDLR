import { parseFitBuffer } from '../services/fitParser'

const SEMICIRCLES_TO_DEGREES = 180 / Math.pow(2, 31)

const mockParseAsync = jest.fn()

// fit-file-parser is ESM-only; mock the dynamic import.
// __esModule: true is required so TypeScript's __importStar sets .default correctly.
jest.mock(
  'fit-file-parser',
  () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ parseAsync: mockParseAsync })),
  }),
  { virtual: true },
)

const SESSION = {
  start_time: new Date('2024-03-01T08:00:00Z'),
  total_elapsed_time: 1800,
  total_distance: 5000,
  avg_heart_rate: 145,
  max_heart_rate: 175,
  avg_cadence: 85,
  total_ascent: 42,
}

const RECORDS = [
  { heart_rate: 140, speed: 3.0, position_lat: Math.round(51.5 / SEMICIRCLES_TO_DEGREES), position_long: Math.round(-0.1 / SEMICIRCLES_TO_DEGREES) },
  { heart_rate: 145, speed: 3.2, position_lat: Math.round(51.501 / SEMICIRCLES_TO_DEGREES), position_long: Math.round(-0.101 / SEMICIRCLES_TO_DEGREES) },
  { heart_rate: 150, speed: 3.1 },
]

describe('parseFitBuffer', () => {
  beforeEach(() => {
    mockParseAsync.mockResolvedValue({ sessions: [SESSION], records: RECORDS })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('extracts name from filename', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'morning_run.fit')
    expect(result.name).toBe('morning run')
  })

  it('uses session start_time as date', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.date).toEqual(new Date('2024-03-01T08:00:00Z'))
  })

  it('extracts distanceMeters from session', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.distanceMeters).toBe(5000)
  })

  it('extracts durationSeconds from session', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.durationSeconds).toBe(1800)
  })

  it('extracts hrStream from records', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.hrStream).toEqual([140, 145, 150])
  })

  it('computes avgHR from hrStream (not session)', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.avgHR).toBe(145)
  })

  it('computes maxHR from hrStream (not session)', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.maxHR).toBe(150)
  })

  it('extracts cadenceAvg and elevationGainMeters from session', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.cadenceAvg).toBe(85)
    expect(result.elevationGainMeters).toBe(42)
  })

  it('converts semicircle coordinates to degrees', async () => {
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.coordinates).toHaveLength(2) // third record has no lat/lon
    expect(result.coordinates![0][0]).toBeCloseTo(51.5, 2)
    expect(result.coordinates![0][1]).toBeCloseTo(-0.1, 2)
  })

  it('falls back to session avgHR/maxHR when no records have HR', async () => {
    mockParseAsync.mockResolvedValue({ sessions: [SESSION], records: [{ speed: 3.0 }] })
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.avgHR).toBe(145)
    expect(result.maxHR).toBe(175)
  })

  it('handles empty sessions and records', async () => {
    mockParseAsync.mockResolvedValue({})
    const result = await parseFitBuffer(Buffer.from(''), 'test.fit')
    expect(result.distanceMeters).toBe(0)
    expect(result.hrStream).toEqual([])
    expect(result.coordinates).toBeUndefined()
  })

  it('propagates parseAsync rejection', async () => {
    mockParseAsync.mockRejectedValue(new Error('corrupt file'))
    await expect(parseFitBuffer(Buffer.from(''), 'bad.fit')).rejects.toThrow('corrupt file')
  })
})
