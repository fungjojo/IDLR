// Manual mock for services/api.ts — avoids loading the real file which uses
// import.meta.env (Vite-only syntax that crashes Jest's CommonJS runtime).
import axios from 'axios'

const api = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
} as unknown as typeof axios

export default api
