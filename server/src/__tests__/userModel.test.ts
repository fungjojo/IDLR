import mongoose from 'mongoose'
import { User } from '../models/User'
import { encrypt } from '../utils/crypto'

const ENCRYPTION_KEY = 'a'.repeat(64)

// save() can't reach a real DB in this suite — disable buffering so it
// rejects immediately once the pre-save hook (the thing under test) runs,
// instead of hanging until mongoose's connection buffer times out.
beforeAll(() => mongoose.set('bufferCommands', false))

describe('User pre-save hook (token encryption)', () => {
  afterEach(() => { delete process.env.ENCRYPTION_KEY })

  it('encrypts stravaAccessToken and stravaRefreshToken when ENCRYPTION_KEY is set', async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY
    const doc = new User({
      name: 'Jojo',
      email: 'jojo@test.com',
      passwordHash: 'hash',
      stravaAccessToken: 'plain-access-token',
      stravaRefreshToken: 'plain-refresh-token',
    })
    await expect(doc.save()).rejects.toThrow()
    expect(doc.stravaAccessToken).not.toBe('plain-access-token')
    expect(doc.stravaRefreshToken).not.toBe('plain-refresh-token')
    expect(doc.stravaAccessToken?.split(':')).toHaveLength(3)
  })

  it('leaves tokens as plaintext when ENCRYPTION_KEY is not set', async () => {
    const doc = new User({
      name: 'Jojo',
      email: 'jojo@test.com',
      passwordHash: 'hash',
      stravaAccessToken: 'plain-access-token',
    })
    await expect(doc.save()).rejects.toThrow()
    expect(doc.stravaAccessToken).toBe('plain-access-token')
  })

  it('does not touch fields that were not provided', async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY
    const doc = new User({ name: 'Jojo', email: 'jojo@test.com', passwordHash: 'hash' })
    await expect(doc.save()).rejects.toThrow()
    expect(doc.stravaAccessToken).toBeUndefined()
    expect(doc.stravaRefreshToken).toBeUndefined()
  })
})

describe('User post-init hook (token decryption)', () => {
  afterEach(() => { delete process.env.ENCRYPTION_KEY })

  it('decrypts stravaAccessToken on load when ENCRYPTION_KEY is set', () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY
    const ciphertext = encrypt('secret-token')
    const doc = User.hydrate({
      name: 'Jojo',
      email: 'jojo@test.com',
      passwordHash: 'hash',
      stravaAccessToken: ciphertext,
    })
    expect(doc.stravaAccessToken).toBe('secret-token')
  })

  it('leaves value untouched when ENCRYPTION_KEY is not set', () => {
    const doc = User.hydrate({
      name: 'Jojo',
      email: 'jojo@test.com',
      passwordHash: 'hash',
      stravaAccessToken: 'some-stored-value',
    })
    expect(doc.stravaAccessToken).toBe('some-stored-value')
  })

  it('leaves value untouched when decryption fails (pre-encryption legacy data)', () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY
    const doc = User.hydrate({
      name: 'Jojo',
      email: 'jojo@test.com',
      passwordHash: 'hash',
      stravaAccessToken: 'legacy-plaintext-token',
    })
    expect(doc.stravaAccessToken).toBe('legacy-plaintext-token')
  })

  it('does nothing when no strava fields are present', () => {
    const doc = User.hydrate({ name: 'Jojo', email: 'jojo@test.com', passwordHash: 'hash' })
    expect(doc.stravaAccessToken).toBeUndefined()
    expect(doc.stravaRefreshToken).toBeUndefined()
  })
})
