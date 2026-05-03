export interface BaseUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  maxHR: number
}
