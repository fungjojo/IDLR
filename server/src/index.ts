import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set')
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT ?? 4000
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/idlr'

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)

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
