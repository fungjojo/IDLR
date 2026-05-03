import { type Response } from 'express'
import mongoose from 'mongoose'
import { User } from '../models/User'
import { type AuthRequest } from '../middleware/auth'

export async function getUsers(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await User.find({}, { passwordHash: 0, stravaAccessToken: 0, stravaRefreshToken: 0 }).sort({ createdAt: -1 })
    res.json({ users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      maxHR: u.maxHR,
      createdAt: u.createdAt,
    })) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid user ID' })
    return
  }

  if (req.user?.id === id) {
    res.status(400).json({ message: 'Cannot delete your own account' })
    return
  }

  try {
    const user = await User.findByIdAndDelete(id)
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }
    res.json({ message: 'User deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}
