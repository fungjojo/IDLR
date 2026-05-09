import { Schema, model, type Document } from 'mongoose'
import { encrypt, decrypt } from '../utils/crypto'

export interface IUser extends Document {
  name: string
  email: string
  passwordHash: string
  role: 'admin' | 'member'
  maxHR: number
  loginAttempts: number
  lockedUntil?: Date
  stravaAccessToken?: string
  stravaRefreshToken?: string
  stravaAthleteId?: number
  createdAt: Date
  updatedAt: Date
}

const STRAVA_TOKEN_FIELDS = ['stravaAccessToken', 'stravaRefreshToken'] as const

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    maxHR: { type: Number, default: 190 },
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    stravaAccessToken: String,
    stravaRefreshToken: String,
    stravaAthleteId: Number,
  },
  { timestamps: true },
)

// Encrypt Strava OAuth tokens before saving — only when ENCRYPTION_KEY is configured
userSchema.pre('save', function (next) {
  if (!process.env.ENCRYPTION_KEY) return next()
  for (const field of STRAVA_TOKEN_FIELDS) {
    const value = this[field]
    if (this.isModified(field) && typeof value === 'string') {
      this[field] = encrypt(value)
    }
  }
  next()
})

// Decrypt on load so callers always work with plaintext
userSchema.post('init', function (doc: IUser) {
  if (!process.env.ENCRYPTION_KEY) return
  for (const field of STRAVA_TOKEN_FIELDS) {
    const value = doc[field]
    if (typeof value === 'string') {
      try {
        doc[field] = decrypt(value)
      } catch {
        // value was stored before encryption was enabled — leave as-is
      }
    }
  }
})

export const User = model<IUser>('User', userSchema)
