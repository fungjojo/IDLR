import { Schema, model, type Document, type Types } from 'mongoose'

export interface IActivity extends Document {
  userId: Types.ObjectId
  source: 'strava' | 'manual'
  stravaActivityId?: number
  name: string
  date: Date
  distanceMeters: number
  durationSeconds: number
  avgHR: number
  maxHR: number
  hrStream: number[]
  paceStream: number[]
  cadenceAvg?: number
  elevationGainMeters?: number
  coordinates?: [number, number][]
  createdAt: Date
  updatedAt: Date
}

const activitySchema = new Schema<IActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: ['strava', 'manual'], required: true },
    stravaActivityId: Number,
    name: { type: String, required: true },
    date: { type: Date, required: true },
    distanceMeters: { type: Number, required: true },
    durationSeconds: { type: Number, required: true },
    avgHR: { type: Number, required: true },
    maxHR: { type: Number, required: true },
    hrStream: { type: [Number], default: [] },
    paceStream: { type: [Number], default: [] },
    cadenceAvg: Number,
    elevationGainMeters: Number,
    coordinates: { type: [[Number]], default: undefined },
  },
  { timestamps: true },
)

export const Activity = model<IActivity>('Activity', activitySchema)
