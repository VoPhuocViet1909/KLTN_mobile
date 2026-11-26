// Dựa trên GIT_frontend/src/auth/AuthProvider.tsx (commit 9d5677d), giữ đồng bộ khi web đổi.
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { authApi } from '@/api/auth'
import { onSessionExpired, refreshAccessToken, revokeCurrentSession } from '@/api/client'
import { tokenStore } from '@/api/tokenStore'
import {
  MSG_SESSION_ENDED,
  MSG_ORG_UNAVAILABLE,
  ORGANIZATION_INACTIVE,
  ORGANIZATION_UNAVAILABLE,
  toApiError,
} from '@/lib/errors'
import { connectivity } from '@/lib/connectivity'
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

  useEffect(() =>
    onSessionExpired((end) => {
      setNotice((prev) => end.notice ?? prev)
      reset()
    }), [reset])

  // Phiên lưu trên máy chỉ vào vùng đã đăng nhập sau khi máy chủ xác nhận lại.
  useEffect(() => {
    let cancelled = false
    let loaded = false
    let finished = false
    let running = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    async function restore() {
      if (!loaded || running || cancelled || finished) return
      if (!tokenStore.getRefreshToken()) {
        finished = true
        setStatus('anonymous')
        return
      }
      clearTimeout(retryTimer)
      running = true
      const generation = tokenStore.getSessionGeneration()
      try {
        if (!tokenStore.getAccessToken()) await refreshAccessToken()
        const current = await authApi.me()
        if (cancelled || generation !== tokenStore.getSessionGeneration()) return
        await tokenStore.setUser(current)
        if (cancelled || generation !== tokenStore.getSessionGeneration()) return
        finished = true
        setUser(current)
        setNotice(null)
        setStatus('authenticated')
      } catch (error) {
        if (cancelled) return
        if (generation !== tokenStore.getSessionGeneration()) {
          finished = true
          return
        }
        const failure = toApiError(error)
        if (failure.status === 401 || failure.code === ORGANIZATION_INACTIVE) {
          finished = true
          await tokenStore.clear()
          if (cancelled) return
          setNotice(MSG_SESSION_ENDED)
          reset()
          return
        }
        setNotice(failure.code === ORGANIZATION_UNAVAILABLE ? MSG_ORG_UNAVAILABLE : null)
        setStatus('restoring')
        retryTimer = setTimeout(restore, 15_000)
      } finally {
        running = false
      }
    }

    const unsubscribe = connectivity.subscribe(() => {
      if (!connectivity.isOffline()) void restore()
    })
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void restore()
    })
    void tokenStore.load().then(() => {
      if (cancelled) return
      loaded = true
      if (tokenStore.getRefreshToken()) setStatus('restoring')
      void restore()
    })
    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      unsubscribe()
      subscription.remove()
    }
  }, [reset])

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
    const profile = { ...res.user, email }
    await tokenStore.setUser(profile)
    setUser(profile)
    setStatus('authenticated')
    setNotice(null)
    return profile
  }, [])

  const logout = useCallback(async () => {
    setNotice(null)
    disconnectRealtime()
    try {
      await revokeCurrentSession()
    } catch {
      /* vẫn đăng xuất phía máy */
    }
    reset()
  }, [reset])

  const value = useMemo(
    () => ({ user, status, notice, login, logout }),
    [user, status, notice, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
