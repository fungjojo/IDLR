import request from 'supertest'
import app from '../app'

jest.mock('../models/User')
jest.mock('../models/RefreshToken')

describe('Security headers (helmet)', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('sets X-Frame-Options: SAMEORIGIN', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  it('sets Referrer-Policy header', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['referrer-policy']).toBeDefined()
  })

  it('sets content-security-policy header', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['content-security-policy']).toBeDefined()
  })
})
