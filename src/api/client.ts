// Chép từ GIT_frontend/src/lib/api/client.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
// Khác web: baseURL tuyệt đối từ EXPO_PUBLIC_API_URL; token lưu SecureStore; không có media/WHEP.
import axios, { CanceledError, create, isAxiosError, isCancel, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { connectivity } from '@/lib/connectivity'
import { MSG_ORG_INACTIVE, MSG_SESSION_ENDED, ORGANIZATION_INACTIVE, toApiError } from '@/lib/errors'
import type { TokenPair } from '@/lib/types'
import { API_BASE } from './env'
import { tokenStore } from './tokenStore'

export const api = create({ baseURL: API_BASE, timeout: 15_000 })

// Các endpoint không cần token và không được kích hoạt refresh.
const OPEN_PATHS = ['/auth/login', '/auth/refresh', '/auth/.well-known/jwks.json', '/health']
const isOpen = (url = '') => OPEN_PATHS.some((p) => url.startsWith(p))

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean; _session?: number }
const LOGOUT_PATH = '/auth/logout'

api.interceptors.request.use((config: RetriableConfig) => {
  config._session ??= tokenStore.getSessionGeneration()
  if (config._session !== tokenStore.getSessionGeneration()) {
    throw new CanceledError('Session changed')
  }
  const token = tokenStore.getAccessToken()
  if (token && !isOpen(config.url)) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ---------- Refresh token dùng một lần: chỉ cho MỘT request refresh chạy tại một thời điểm ----------

let refreshing: Promise<string> | null = null
let signingOut: Promise<void> | null = null
/** `notice`: lý do cần hiện ở màn đăng nhập (tổ chức tạm ngưng); không có thì chỉ là hết phiên thường. */
type SessionEnd = { notice?: string }
const sessionExpiredListeners = new Set<(end: SessionEnd) => void>()

function endSession(end: SessionEnd = {}) {
  void tokenStore.clear()
  sessionExpiredListeners.forEach((fn) => fn(end))
}

/** Đăng ký hàm gọi khi phiên hết hạn hẳn (refresh thất bại, tổ chức tạm ngưng) – AuthProvider dùng để đưa về màn đăng nhập. */
export function onSessionExpired(fn: (end: SessionEnd) => void) {
  sessionExpiredListeners.add(fn)
  return () => {
    sessionExpiredListeners.delete(fn)
  }
}

/**
 * Lấy access token mới. Nhiều nơi gọi cùng lúc thì dùng chung một lần gọi /auth/refresh,
 * vì refresh token cũ bị thu hồi ngay sau lần dùng đầu tiên.
 */
export function refreshAccessToken(): Promise<string> {
  if (signingOut) return Promise.reject(new CanceledError('Signing out'))
  return rotateAccessToken()
}

function rotateAccessToken(): Promise<string> {
  if (!refreshing) {
    const session = tokenStore.getSessionGeneration()
    refreshing = (async () => {
      const current = tokenStore.getRefreshToken()
      if (!current) throw new Error('NO_REFRESH_TOKEN')
      const { data } = await axios.post<TokenPair>(
        `${API_BASE}/auth/refresh`,
        { refreshToken: current },
        { timeout: 15_000 },
      )
      if (session !== tokenStore.getSessionGeneration()) throw new CanceledError('Session changed')
      // Ghi refresh token mới xuống SecureStore xong mới trả access token: tắt app giữa chừng vẫn còn token hợp lệ.
      await tokenStore.setTokens(data)
      return data.accessToken
    })()
      .catch((err) => {
        if (signingOut || session !== tokenStore.getSessionGeneration()) throw err
        // Lỗi mạng và 5xx (kể cả 503 ORGANIZATION_UNAVAILABLE): giữ phiên, để lần sau thử lại.
        // 400/401/403: phiên đã hết. Backend trả 401 cả khi tổ chức tạm ngưng (không tiết lộ), nên không phân biệt được.
        const status = isAxiosError(err) ? err.response?.status : undefined
        if (status === 400 || status === 401 || status === 403) {
          const code = (err.response?.data as { code?: string } | undefined)?.code
          endSession({ notice: code === ORGANIZATION_INACTIVE ? MSG_ORG_INACTIVE : MSG_SESSION_ENDED })
        } else if (err instanceof Error && err.message === 'NO_REFRESH_TOKEN') {
          endSession()
        }
        throw err
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

// Logout cần gửi token mới nhất sau khi lượt refresh đang chạy kết thúc.
export function revokeCurrentSession(): Promise<void> {
  signingOut ??= (async () => {
    try {
      await refreshing
    } catch {
      // Sau lỗi tạm thời vẫn có thể còn token để thu hồi.
    }
    const refreshToken = tokenStore.getRefreshToken()
    if (refreshToken) await request<void>({ method: 'POST', url: LOGOUT_PATH, data: { refreshToken } })
  })().finally(async () => {
    await tokenStore.clear()
    signingOut = null
  })
  return signingOut
}

api.interceptors.response.use(
  (res) => {
    connectivity.report(true)
    return res
  },
  async (error) => {
    // Không có response = lỗi mạng/hết thời gian: bật banner "Mất kết nối máy chủ". Có response thì máy chủ còn đó.
    if (isAxiosError(error) && !isCancel(error)) connectivity.report(!!error.response)
    const config = error.config as RetriableConfig | undefined
    const status = error.response?.status
    const sameSession = config?._session === tokenStore.getSessionGeneration()
    if (status === 401 && config && sameSession && !config._retried && !isOpen(config.url)) {
      config._retried = true
      try {
        if (config.url === LOGOUT_PATH) {
          await rotateAccessToken()
          config.data = { refreshToken: tokenStore.getRefreshToken() }
        } else {
          const current = tokenStore.getAccessToken()
          if (!current || config.headers.Authorization === `Bearer ${current}`) await refreshAccessToken()
        }
        return api(config)
      } catch {
        /* rơi xuống trả lỗi gốc */
      }
    }
    const apiError = toApiError(error)
    // Tổ chức bị SYS_ADMIN tạm ngưng: token còn hạn nhưng Gateway không cho đi tiếp, refresh cũng vô ích -> về màn đăng nhập.
    if (!signingOut && sameSession && apiError.status === 403 && apiError.code === ORGANIZATION_INACTIVE && tokenStore.getRefreshToken()) {
      endSession({ notice: MSG_ORG_INACTIVE })
    }
    return Promise.reject(apiError)
  },
)

/** Tiện ích: gọi API và trả thẳng data. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const { data } = await api.request<T>(config)
  return data
}
