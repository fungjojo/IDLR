import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app'

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set')
  process.exit(1)
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
