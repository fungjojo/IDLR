import {
  computeHrStats, speedToPace, deriveActivityName, type ActivityData,
} from './activityTypes'

const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31

interface ParsedRecord {
  position_lat?: number
  position_long?: number
  heart_rate?: number
  speed?: number
  cadence?: number
}

interface ParsedSession {
  start_time?: Date
  total_elapsed_time?: number
  total_distance?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_cadence?: number
  total_ascent?: number
}

interface ParsedFit {
  sessions?: ParsedSession[]
  records?: ParsedRecord[]
}

export async function parseFitBuffer(buffer: Buffer, filename: string): Promise<ActivityData> {
  // Dynamic import required — fit-file-parser is ESM-only
  const { default: FitParser } = await import('fit-file-parser') as { default: new (opts: object) => { parseAsync(buf: Buffer): Promise<ParsedFit> } }

  const parser = new FitParser({
    force: true, speedUnit: 'm/s', lengthUnit: 'm', mode: 'list',
  })
  const parsed: ParsedFit = await parser.parseAsync(buffer)

  const session: ParsedSession = parsed.sessions?.[0] ?? {}
  const records: ParsedRecord[] = parsed.records ?? []

  const hrStream = records.map((r) => r.heart_rate ?? 0).filter(Boolean)
  const paceStream = records.map((r) => speedToPace(r.speed ?? 0))

  const coordinates = records.reduce<[number, number][]>((acc, r) => {
    if (r.position_lat != null && r.position_long != null) {
      acc.push([
        r.position_lat * SEMICIRCLES_TO_DEGREES,
        r.position_long * SEMICIRCLES_TO_DEGREES,
      ])
    }
    return acc
  }, [])

  const { avgHR, maxHR } = computeHrStats(hrStream, {
    avgHR: session.avg_heart_rate,
    maxHR: session.max_heart_rate,
  })

  const baseName = deriveActivityName(filename)
  const date = session.start_time instanceof Date ? session.start_time : new Date()

  return {
    name: baseName || 'Manual activity',
    date,
    distanceMeters: session.total_distance ?? 0,
    durationSeconds: session.total_elapsed_time ?? 0,
    avgHR,
    maxHR,
    hrStream,
    paceStream,
    cadenceAvg: session.avg_cadence,
    elevationGainMeters: session.total_ascent,
    coordinates: coordinates.length > 0 ? coordinates : undefined,
  }
}
