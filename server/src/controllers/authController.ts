import { type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { type AuthRequest } from '../middleware/auth'

const JWT_EXPIRES = '7d'
const MAX_PASSWORD_LENGTH = 72
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password required' })
    return
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ message: 'Password too long' })
    return
  }

  const normalisedEmail = email.trim().toLowerCase()

  if (!EMAIL_REGEX.test(normalisedEmail)) {
    res.status(400).json({ message: 'Invalid email format' })
    return
  }

  try {
    const user = await User.findOne({ email: normalisedEmail })
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES },
    )

    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        maxHR: user.maxHR,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const { name, email, password, maxHR = 190 } = req.body as {
    name?: string
    email?: string
    password?: string
    maxHR?: number
  }

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email and password required' })
    return
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    res.status(400).json({ message: 'Password too long' })
    return
  }

  const normalisedEmail = email.trim().toLowerCase()

  if (!EMAIL_REGEX.test(normalisedEmail)) {
    res.status(400).json({ message: 'Invalid email format' })
    return
  }

  try {
    const existing = await User.findOne({ email: normalisedEmail })
    if (existing) {
      res.status(409).json({ message: 'Email already in use' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email: normalisedEmail, passwordHash, role: 'member', maxHR })

    res.status(201).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        maxHR: user.maxHR,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}
