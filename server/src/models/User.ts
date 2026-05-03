import { Schema, model, type Document } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  passwordHash: string
  role: 'admin' | 'member'
  maxHR: number
  // TODO: encrypt stravaAccessToken and stravaRefreshToken at rest before Strava integration ships
  stravaAccessToken?: string
  stravaRefreshToken?: string
  stravaAthleteId?: number
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    maxHR: { type: Number, default: 190 },
    stravaAccessToken: String,
    stravaRefreshToken: String,
    stravaAthleteId: Number,
  },
  { timestamps: true },
)

export const User = model<IUser>('User', userSchema)
