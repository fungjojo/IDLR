import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User } from './models/User'

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/idlr'

const ADMIN = {
  name: 'Jojo',
  email: 'admin@idlr.com',
  // password is read from env so it never lives in source control in production
  password: process.env.SEED_ADMIN_PASSWORD ?? 'admin123',
  role: 'admin' as const,
  maxHR: 190,
}

async function seed() {
  await mongoose.connect(MONGO_URI)

  const existing = await User.findOne({ email: ADMIN.email })
  if (existing) {
    console.log('Admin already exists:', ADMIN.email)
    await mongoose.disconnect()
    return
  }

  const passwordHash = await bcrypt.hash(ADMIN.password, 10)
  const { password, ...adminData } = ADMIN
  await User.create({ ...adminData, passwordHash })

  console.log('Admin created:')
  console.log('  Email:   ', ADMIN.email)
  console.log('  Password:', ADMIN.password)

  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
