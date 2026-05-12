import api from './api'
import type { BaseUser } from '../types/user'

export interface Member extends BaseUser {
  createdAt: string
}

export async function fetchMembers(): Promise<Member[]> {
  const res = await api.get<{ users: Member[] }>('/api/users')
  return res.data.users
}

export async function deleteMember(id: string): Promise<void> {
  await api.delete(`/api/users/${id}`)
}

export interface CreateMemberPayload {
  name: string
  email: string
  password: string
  maxHR?: number
}

export async function createMember(payload: CreateMemberPayload): Promise<Member> {
  const res = await api.post<{ user: Member }>('/api/auth/register', payload)
  return res.data.user
}
