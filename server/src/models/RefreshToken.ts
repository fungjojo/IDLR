import { Schema, model, type Document, type Types } from 'mongoose'

export interface IRefreshToken extends Document {
  jti: string
  userId: Types.ObjectId
  expiresAt: Date
  revokedAt?: Date
  createdAt: Date
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    jti: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// MongoDB TTL index — auto-removes expired tokens from the collection
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema)
