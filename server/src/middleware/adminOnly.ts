import { type Response, type NextFunction } from 'express'
import { type AuthRequest } from './auth'

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' })
    return
  }
  next()
}
