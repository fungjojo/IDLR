import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app'

jest.mock('../models/User')
jest.mock('../models/RefreshToken')

const JWT_SECRET = 'test-secret-at-least-32-characters-long'

function memberCookie(): string {
  const token = jwt.sign(
    { id: 'member-id-1', role: 'member' },
    JWT_SECRET,
    { algorithm: 'HS256', issuer: 'idlr', audience: 'idlr-client' },
  )
  return `idlr_token=${token}`
}

function adminCookie(): string {
  const token = jwt.sign(
    { id: 'admin-id-1', role: 'admin' },
    JWT_SECRET,
    { algorithm: 'HS256', issuer: 'idlr', audience: 'idlr-client' },
  )
  return `idlr_token=${token}`
}

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET
})

afterAll(() => {
  delete process.env.JWT_SECRET
})

describe('GET /api/users', () => {
  it('returns 403 when called with a member cookie', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', memberCookie())
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ message: 'Admin access required' })
  })

  it('returns 401 when called with no token', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/users/:id', () => {
  it('returns 403 when called with a member cookie', async () => {
    const res = await request(app)
      .delete('/api/users/507f1f77bcf86cd799439011')
      .set('Cookie', memberCookie())
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ message: 'Admin access required' })
  })

  it('returns 401 when called with no token', async () => {
    const res = await request(app)
      .delete('/api/users/507f1f77bcf86cd799439011')
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid ObjectId when called with an admin cookie', async () => {
    const res = await request(app)
      .delete('/api/users/not-a-valid-id')
      .set('Cookie', adminCookie())
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ message: 'Invalid user ID' })
  })
})
