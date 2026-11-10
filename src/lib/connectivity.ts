// Trạng thái "máy chủ có với tới được không", do axios interceptor báo (src/api/client.ts).
// Lỗi mạng / hết thời gian (không có response) => mất kết nối. Có response (kể cả 4xx/5xx) => máy chủ còn đó.
import { useSyncExternalStore } from 'react'

let offline = false
const listeners = new Set<() => void>()

export const connectivity = {
  isOffline: () => offline,
  /** `reachable` = true khi nhận được phản hồi từ máy chủ. */
  report(reachable: boolean) {
    if (offline === !reachable) return
    offline = !reachable
    listeners.forEach((fn) => fn())
  },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}

export const useServerOffline = () => useSyncExternalStore(connectivity.subscribe, connectivity.isOffline)
