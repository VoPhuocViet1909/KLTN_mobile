// Dựa trên GIT_frontend/src/lib/api/tokenStore.ts (commit 9d5677d), nhưng lưu bằng expo-secure-store
// (Keychain iOS / Keystore Android) thay cho localStorage. SecureStore chỉ có API bất đồng bộ nên giữ
// bản sao trong bộ nhớ: đọc đồng bộ, ghi xuống SecureStore chạy nền. Gọi `load()` một lần lúc mở app.
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import type { SessionUser, TokenPair } from '@/lib/types'

const REFRESH_KEY = 'kltn.refreshToken'
const USER_KEY = 'kltn.user'
const DEVICE_KEY = 'kltn.deviceId'

// Access token chỉ nằm trong bộ nhớ (mất khi tắt app, sẽ refresh lại).
let accessToken: string | null = null
let refreshToken: string | null = null
let user: SessionUser | null = null
let deviceId: string | null = null

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key)
    else await SecureStore.setItemAsync(key, value)
  } catch {
    /* không ghi được: chỉ mất khả năng nhớ đăng nhập qua lần mở app sau */
  }
}

export const tokenStore = {
  /** Nạp refresh token, user, deviceId từ SecureStore vào bộ nhớ. */
  async load() {
    refreshToken = await read(REFRESH_KEY)
    deviceId = await read(DEVICE_KEY)
    const raw = await read(USER_KEY)
    try {
      user = raw ? (JSON.parse(raw) as SessionUser) : null
    } catch {
      user = null
    }
  },

  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  getUser: () => user,

  /** deviceId ổn định của máy này (tạo một lần, giữ qua đăng xuất để backend nhận ra cùng một điện thoại). */
  async getDeviceId(): Promise<string> {
    if (!deviceId) {
      deviceId = `mobile-${Crypto.randomUUID()}`
      await write(DEVICE_KEY, deviceId)
    }
    return deviceId
  },

  /** Bộ nhớ đổi ngay (đồng bộ); promise trả về xong khi đã ghi SecureStore. */
  setTokens(pair: TokenPair): Promise<void> {
    accessToken = pair.accessToken
    refreshToken = pair.refreshToken
    return write(REFRESH_KEY, pair.refreshToken)
  },

  setUser(next: SessionUser): Promise<void> {
    user = next
    return write(USER_KEY, JSON.stringify(next))
  },

  /** Xóa phiên (giữ deviceId). */
  async clear() {
    accessToken = null
    refreshToken = null
    user = null
    await Promise.all([write(REFRESH_KEY, null), write(USER_KEY, null)])
  },
}
