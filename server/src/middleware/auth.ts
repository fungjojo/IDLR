import { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: {
    id: string
    role: 'admin' | 'member'
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.idlr_token as string | undefined
  if (!token) {
    res.status(401).json({ message: 'Unauthorised' })
    return
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string, {
      algorithms: ['HS256'],
      issuer: 'idlr',
      audience: 'idlr-client',
    }) as unknown
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('id' in payload) ||
      !('role' in payload) ||
      typeof (payload as Record<string, unknown>).id !== 'string' ||
      ((payload as Record<string, unknown>).role !== 'admin' &&
        (payload as Record<string, unknown>).role !== 'member')
    ) {
      res.status(401).json({ message: 'Invalid token payload' })
      return
    }
    req.user = payload as { id: string; role: 'admin' | 'member' }
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}
