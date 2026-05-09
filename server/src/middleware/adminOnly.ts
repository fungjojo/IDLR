import { type Response, type NextFunction } from 'express'
import { User } from '../models/User'
import { type AuthRequest } from './auth'

export async function adminOnly(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(403).json({ message: 'Admin access required' })
    return
  }
  // Fast path: JWT says not admin — skip DB query
  if (req.user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' })
    return
  }
  // Verify role is still admin in DB (catches role downgrades within the token window)
  try {
    const user = await User.findById(req.user.id).select('role').lean<{ role: 'admin' | 'member' }>()
    if (!user || user.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' })
      return
    }
    next()
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
}
