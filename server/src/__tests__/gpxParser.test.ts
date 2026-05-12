import { parseGpxBuffer } from '../services/gpxParser'

const GPX_WITH_HR = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin" xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>Morning Run</name>
    <trkseg>
      <trkpt lat="51.5" lon="-0.1">
        <time>2024-03-01T08:00:00Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
      </trkpt>
      <trkpt lat="51.501" lon="-0.101">
        <time>2024-03-01T08:00:02Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>145</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
      </trkpt>
      <trkpt lat="51.502" lon="-0.102">
        <time>2024-03-01T08:00:04Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

const GPX_NO_HR = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="51.5" lon="-0.1"><time>2024-03-01T08:00:00Z</time></trkpt>
      <trkpt lat="51.501" lon="-0.101"><time>2024-03-01T08:00:02Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`

const GPX_INVALID = Buffer.from('<not-gpx>hello</not-gpx>')

describe('parseGpxBuffer', () => {
  it('extracts name from GPX', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_WITH_HR), 'test.gpx')
    expect(result.name).toBe('Morning Run')
  })

  it('falls back to filename when no name element', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_NO_HR), 'my_run.gpx')
    expect(result.name).toBe('my run')
  })

  it('extracts HR stream', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_WITH_HR), 'test.gpx')
    expect(result.hrStream).toEqual([140, 145, 150])
  })

  it('computes avgHR from hrStream', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_WITH_HR), 'test.gpx')
    expect(result.avgHR).toBe(145)
  })

  it('computes maxHR from hrStream', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_WITH_HR), 'test.gpx')
    expect(result.maxHR).toBe(150)
  })

  it('extracts coordinates', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_WITH_HR), 'test.gpx')
    expect(result.coordinates).toHaveLength(3)
    expect(result.coordinates![0]).toEqual([51.5, -0.1])
  })

  it('uses first trackpoint time as date', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_WITH_HR), 'test.gpx')
    expect(result.date).toEqual(new Date('2024-03-01T08:00:00Z'))
  })

  it('computes durationSeconds from first/last trackpoint', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_WITH_HR), 'test.gpx')
    expect(result.durationSeconds).toBe(4)
  })

  it('handles missing HR gracefully', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_NO_HR), 'test.gpx')
    expect(result.hrStream).toEqual([])
    expect(result.avgHR).toBe(0)
    expect(result.maxHR).toBe(0)
  })

  it('returns empty coordinates for invalid GPX', () => {
    const result = parseGpxBuffer(GPX_INVALID, 'bad.gpx')
    expect(result.coordinates).toBeUndefined()
  })

  it('computes positive distance between points', () => {
    const result = parseGpxBuffer(Buffer.from(GPX_WITH_HR), 'test.gpx')
    expect(result.distanceMeters).toBeGreaterThan(0)
  })
})
