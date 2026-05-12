import type { ActivityData } from './activityTypes'

function extractText(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
  return match?.[1]?.trim()
}

function extractAttr(xml: string, tag: string, attr: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"[^>]*>`))
  return match?.[1]
}

interface Trkpt {
  lat: number
  lon: number
  hr?: number
  time?: Date
  speed?: number
}

function parseTrkpt(xml: string): Trkpt | null {
  const lat = parseFloat(extractAttr(xml, 'trkpt', 'lat') ?? '')
  const lon = parseFloat(extractAttr(xml, 'trkpt', 'lon') ?? '')
  if (isNaN(lat) || isNaN(lon)) return null

  const hrText = extractText(xml, 'gpxtpx:hr') ?? extractText(xml, 'ns3:hr') ?? extractText(xml, 'hr')
  const hr = hrText ? parseInt(hrText, 10) : undefined

  const timeText = extractText(xml, 'time')
  const time = timeText ? new Date(timeText) : undefined

  const speedText = extractText(xml, 'gpxtpx:speed') ?? extractText(xml, 'ns3:speed') ?? extractText(xml, 'speed')
  const speed = speedText ? parseFloat(speedText) : undefined

  return { lat, lon, hr, time, speed }
}

export function parseGpxBuffer(buffer: Buffer, filename: string): ActivityData {
  const xml = buffer.toString('utf-8')

  const nameText = extractText(xml, 'name')
  const baseName = nameText || filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

  // Extract all <trkpt> blocks
  const trkptBlocks = xml.match(/<trkpt[\s\S]*?<\/trkpt>/g) ?? []
  const points = trkptBlocks.map(parseTrkpt).filter((p): p is Trkpt => p !== null)

  const hrStream = points.map(p => p.hr ?? 0).filter(Boolean)
  const paceStream = points.map(p => {
    const speed = p.speed ?? 0
    return speed > 0 ? 1000 / speed : 0
  })
  const coordinates = points.map<[number, number]>(p => [p.lat, p.lon])

  const avgHR = hrStream.length > 0
    ? Math.round(hrStream.reduce((s, v) => s + v, 0) / hrStream.length)
    : 0
  const maxHRVal = hrStream.length > 0 ? Math.max(...hrStream) : 0

  // Date from first trackpoint or fallback
  const date = points[0]?.time ?? new Date()

  // Distance: sum haversine between consecutive points
  let distanceMeters = 0
  for (let i = 1; i < points.length; i++) {
    distanceMeters += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon)
  }

  const durationSeconds = points.length >= 2 && points[0].time && points[points.length - 1].time
    ? (points[points.length - 1].time!.getTime() - points[0].time!.getTime()) / 1000
    : 0

  return {
    name: baseName || 'Manual activity',
    date,
    distanceMeters,
    durationSeconds,
    avgHR,
    maxHR: maxHRVal,
    hrStream,
    paceStream,
    coordinates: coordinates.length > 0 ? coordinates : undefined,
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
