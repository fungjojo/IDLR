import { Schema, model, type Document } from 'mongoose'

export interface IIdempotencyKey extends Document {
  key: string
  userId: string
  statusCode: number
  body: string
  createdAt: Date
}

const idempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    key: { type: String, required: true },
    userId: { type: String, required: true },
    statusCode: { type: Number, default: 0 },
    body: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

idempotencyKeySchema.index({ key: 1, userId: 1 }, { unique: true })
// TTL index — auto-removes cached responses after 24 hours
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

export const IdempotencyKey = model<IIdempotencyKey>('IdempotencyKey', idempotencyKeySchema)
