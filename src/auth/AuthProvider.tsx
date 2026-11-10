// Dựa trên GIT_frontend/src/auth/AuthProvider.tsx (commit 9d5677d), giữ đồng bộ khi web đổi.
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { authApi } from '@/api/auth'
import { onSessionExpired, refreshAccessToken } from '@/api/client'
import { tokenStore } from '@/api/tokenStore'
import {
  ApiError,
  MSG_ORG_UNAVAILABLE,
  ORGANIZATION_INACTIVE,
  ORGANIZATION_UNAVAILABLE,
  toApiError,
} from '@/lib/errors'
import type { SessionUser } from '@/lib/types'
import { disconnectRealtime, reconnectIfNeeded } from '@/realtime/socket'
import { AuthContext, type AuthStatus } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [notice, setNotice] = useState<string | null>(null)

  const reset = useCallback(() => {
    disconnectRealtime()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')
  }, [queryClient])

  // Mở app: có refresh token thì lấy access token mới + /auth/me, không thì về màn đăng nhập.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await tokenStore.load()
      const stored = tokenStore.getUser()
      if (!tokenStore.getRefreshToken() || !stored) {
        if (!cancelled) setStatus('anonymous')
        return
      }
      try {
        await refreshAccessToken()
        let current = stored
        try {
          current = await authApi.me()
          await tokenStore.setUser(current)
        } catch (e) {
          // 401: phiên hỏng; 403 ORGANIZATION_INACTIVE: tổ chức tạm ngưng (client.ts đã xóa token và đặt thông báo)
          if (e instanceof ApiError && (e.status === 401 || e.code === ORGANIZATION_INACTIVE)) throw e
        }
        if (!cancelled) {
          setUser(current)
          setStatus('authenticated')
        }
      } catch (e) {
        if (cancelled) return
        // 503: chưa kiểm được tổ chức (phiên vẫn còn) – nói rõ để người dùng thử lại thay vì tưởng bị đăng xuất.
        if (toApiError(e).code === ORGANIZATION_UNAVAILABLE) setNotice(MSG_ORG_UNAVAILABLE)
        // Mất mạng lúc mở app: refresh token còn nguyên trong SecureStore, người dùng đăng nhập lại cũng được.
        setStatus('anonymous')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () =>
      onSessionExpired((end) => {
        setNotice((prev) => end.notice ?? prev)
        reset()
      }),
    [reset],
  )

  // Về foreground: nối lại Socket.IO nếu bị cắt khi app ở nền.
  useEffect(() => {
    if (status !== 'authenticated') return
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') reconnectIfNeeded()
    })
    return () => sub.remove()
  }, [status])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    await tokenStore.setTokens(res)
    await tokenStore.setUser(res.user)
    setUser(res.user)
    setStatus('authenticated')
    setNotice(null)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    setNotice(null)
    const refreshToken = tokenStore.getRefreshToken()
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken)
      } catch {
        /* vẫn đăng xuất phía máy */
      }
    }
    await tokenStore.clear()
    reset()
  }, [reset])

  const value = useMemo(
    () => ({ user, status, notice, login, logout }),
    [user, status, notice, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
