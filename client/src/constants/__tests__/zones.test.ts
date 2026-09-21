import { getZoneForHR, GARMIN_ZONES } from '../zones'

describe('getZoneForHR', () => {
  const maxHR = 190

  it('returns Zone 1 at the low boundary (50%)', () => {
    expect(getZoneForHR(95, maxHR)?.name).toBe('Zone 1')
  })

  it('returns Zone 2 right at its lower boundary (60%)', () => {
    expect(getZoneForHR(114, maxHR)?.name).toBe('Zone 2')
  })

  it('returns Zone 5 at the top of the range', () => {
    expect(getZoneForHR(180.5, maxHR)?.name).toBe('Zone 5')
  })

  it('returns null below Zone 1 (under 50%)', () => {
    expect(getZoneForHR(50, maxHR)).toBeNull()
  })

  it('returns null at exactly 100% (upper bound is exclusive)', () => {
    expect(getZoneForHR(190, maxHR)).toBeNull()
  })

  it('returns null above maxHR', () => {
    expect(getZoneForHR(250, maxHR)).toBeNull()
  })

  it('returns null when maxHR is 0 (avoids Infinity/NaN matches)', () => {
    expect(getZoneForHR(150, 0)).toBeNull()
  })

  it('exposes 5 zones in ascending order', () => {
    expect(GARMIN_ZONES).toHaveLength(5)
    expect(GARMIN_ZONES.map((z) => z.id)).toEqual([1, 2, 3, 4, 5])
  })
})
