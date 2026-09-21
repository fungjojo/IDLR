// eslint-disable-next-line import/no-extraneous-dependencies
import '@testing-library/jest-dom'
import { randomUUID } from 'crypto'

// jsdom's built-in crypto shim doesn't implement randomUUID — polyfill it
// with Node's implementation so code using crypto.randomUUID() is testable.
if (typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = randomUUID
}
