import { encrypt, decrypt } from '../utils/crypto'

const VALID_KEY = 'a'.repeat(64)

describe('crypto utils', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('encrypts and decrypts a string round-trip', () => {
    const plaintext = 'secret-strava-token'
    const ciphertext = encrypt(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const plaintext = 'same-input'
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext))
  })

  it('throws when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('anything')).toThrow('ENCRYPTION_KEY')
  })

  it('throws when ENCRYPTION_KEY is too short', () => {
    process.env.ENCRYPTION_KEY = 'tooshort'
    expect(() => encrypt('anything')).toThrow('ENCRYPTION_KEY')
  })

  it('throws when ENCRYPTION_KEY contains non-hex characters', () => {
    process.env.ENCRYPTION_KEY = 'g'.repeat(64)
    expect(() => encrypt('anything')).toThrow('ENCRYPTION_KEY')
  })

  it('throws on tampered ciphertext', () => {
    const ciphertext = encrypt('hello')
    const tampered = ciphertext.slice(0, -4) + 'ffff'
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws on invalid ciphertext format', () => {
    expect(() => decrypt('not:valid')).toThrow('Invalid ciphertext format')
  })
})
