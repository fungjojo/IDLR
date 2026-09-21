import { computeHrStats, speedToPace, deriveActivityName } from '../services/activityTypes'

describe('activityTypes helpers', () => {
  describe('computeHrStats', () => {
    it('computes average and max from non-empty HR stream', () => {
      const hrStream = [140, 145, 150]
      const result = computeHrStats(hrStream)
      expect(result.avgHR).toBe(145)
      expect(result.maxHR).toBe(150)
    })

    it('rounds average HR to nearest integer', () => {
      const hrStream = [140, 145, 151]
      const result = computeHrStats(hrStream)
      expect(result.avgHR).toBe(145)
    })

    it('rounds up when average is .5 or greater', () => {
      const hrStream = [140, 141]
      const result = computeHrStats(hrStream)
      expect(result.avgHR).toBe(141)
    })

    it('handles empty HR stream with default fallback', () => {
      const result = computeHrStats([])
      expect(result.avgHR).toBe(0)
      expect(result.maxHR).toBe(0)
    })

    it('uses fallback avgHR when HR stream is empty', () => {
      const result = computeHrStats([], { avgHR: 130 })
      expect(result.avgHR).toBe(130)
      expect(result.maxHR).toBe(0)
    })

    it('uses fallback maxHR when HR stream is empty', () => {
      const result = computeHrStats([], { maxHR: 170 })
      expect(result.avgHR).toBe(0)
      expect(result.maxHR).toBe(170)
    })

    it('uses both fallback values when HR stream is empty', () => {
      const result = computeHrStats([], { avgHR: 130, maxHR: 170 })
      expect(result.avgHR).toBe(130)
      expect(result.maxHR).toBe(170)
    })

    it('ignores fallback when HR stream is not empty', () => {
      const hrStream = [140, 150]
      const result = computeHrStats(hrStream, { avgHR: 999, maxHR: 999 })
      expect(result.avgHR).toBe(145)
      expect(result.maxHR).toBe(150)
    })

    it('handles single value HR stream', () => {
      const result = computeHrStats([160])
      expect(result.avgHR).toBe(160)
      expect(result.maxHR).toBe(160)
    })

    it('handles large HR stream without stack overflow', () => {
      const largeStream = Array.from({ length: 15000 }, (_, i) => 130 + (i % 50))
      expect(() => computeHrStats(largeStream)).not.toThrow()
      const result = computeHrStats(largeStream)
      expect(result.maxHR).toBe(179)
    })

    it('finds correct max when it appears multiple times', () => {
      const hrStream = [150, 180, 160, 180, 140]
      const result = computeHrStats(hrStream)
      expect(result.maxHR).toBe(180)
    })

    it('finds max of 0 when stream contains only 0s', () => {
      const hrStream = [0, 0, 0]
      const result = computeHrStats(hrStream)
      expect(result.avgHR).toBe(0)
      expect(result.maxHR).toBe(0)
    })

    it('handles negative HR values (though physiologically unlikely)', () => {
      const hrStream = [-10, 140, 150]
      const result = computeHrStats(hrStream)
      expect(result.avgHR).toBe(93)
      expect(result.maxHR).toBe(150)
    })
  })

  describe('speedToPace', () => {
    it('converts positive speed to pace', () => {
      const pace = speedToPace(3.0)
      expect(pace).toBeCloseTo(333.33, 1)
    })

    it('returns 0 for zero speed', () => {
      expect(speedToPace(0)).toBe(0)
    })

    it('returns 0 for negative speed', () => {
      expect(speedToPace(-1)).toBe(0)
    })

    it('handles very small positive speed', () => {
      const pace = speedToPace(0.001)
      expect(pace).toBeCloseTo(1000000, 0)
    })

    it('handles large speed values', () => {
      const pace = speedToPace(10)
      expect(pace).toBeCloseTo(100, 1)
    })

    it('produces expected result for 1 m/s', () => {
      const pace = speedToPace(1)
      expect(pace).toBe(1000)
    })

    it('is deterministic', () => {
      const speed = 4.5
      const pace1 = speedToPace(speed)
      const pace2 = speedToPace(speed)
      expect(pace1).toBe(pace2)
    })
  })

  describe('deriveActivityName', () => {
    it('removes file extension and replaces underscores with spaces', () => {
      const name = deriveActivityName('morning_run.fit')
      expect(name).toBe('morning run')
    })

    it('replaces underscores with spaces', () => {
      const name = deriveActivityName('morning_run.fit')
      expect(name).toBe('morning run')
    })

    it('replaces dashes with spaces', () => {
      const name = deriveActivityName('morning-run.fit')
      expect(name).toBe('morning run')
    })

    it('replaces both dashes and underscores with spaces', () => {
      const name = deriveActivityName('morning_run-2024.fit')
      expect(name).toBe('morning run 2024')
    })

    it('handles files with no extension', () => {
      const name = deriveActivityName('morning_run')
      expect(name).toBe('morning run')
    })

    it('handles files with multiple dots', () => {
      const name = deriveActivityName('morning.run.2024.fit')
      expect(name).toBe('morning.run.2024')
    })

    it('handles empty filename', () => {
      const name = deriveActivityName('')
      expect(name).toBe('')
    })

    it('handles filename with only extension', () => {
      const name = deriveActivityName('.fit')
      expect(name).toBe('')
    })

    it('handles filename with spaces already in it', () => {
      const name = deriveActivityName('morning run.fit')
      expect(name).toBe('morning run')
    })

    it('handles mixed case', () => {
      const name = deriveActivityName('Morning_Run.FIT')
      expect(name).toBe('Morning Run')
    })
  })
})
