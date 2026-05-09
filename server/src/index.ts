import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters')
  process.exit(1)
}

if (!process.env.REFRESH_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET.length < 32) {
  console.error('FATAL: REFRESH_TOKEN_SECRET must be at least 32 characters')
  process.exit(1)
}

if (process.env.REFRESH_TOKEN_SECRET === process.env.JWT_SECRET) {
  console.error('FATAL: REFRESH_TOKEN_SECRET must differ from JWT_SECRET')
  process.exit(1)
}

if (!process.env.ENCRYPTION_KEY || !/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  console.warn('WARNING: ENCRYPTION_KEY not set or invalid — Strava OAuth tokens will not be encrypted at rest')
}

const PORT = process.env.PORT ?? 4000
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/idlr'

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('MongoDB connected')
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  } catch (err) {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  }
}

start()
