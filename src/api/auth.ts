// Dựa trên GIT_frontend/src/lib/api/auth.ts (commit 9d5677d). Mobile gửi deviceName "Mobile App" + deviceId ổn định.
import type { LoginResponse, SessionUser } from '@/lib/types'
import { request } from './client'
import { tokenStore } from './tokenStore'

export const authApi = {
  login: async (email: string, password: string) =>
    request<LoginResponse>({
      method: 'POST',
      url: '/auth/login',
      data: { email, password, deviceName: 'Mobile App', deviceId: await tokenStore.getDeviceId() },
    }),

  me: () => request<SessionUser>({ method: 'GET', url: '/auth/me' }),
}
