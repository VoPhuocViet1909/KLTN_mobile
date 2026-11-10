// Luật thuần (không phụ thuộc React/Expo) quyết định khi nào hiện thông báo "Bạn đang ngồi sai".
import type { DeviceState, StatusEvent } from '@/realtime/socket'

/** Không quá 1 thông báo cho mỗi loại cảnh báo trong khoảng này. */
export const DEBOUNCE_MS = 5 * 60_000

/**
 * Khi mới kết nối, server gửi lại trạng thái cuối của từng máy; gói cũ hơn mức này là "chuyện đã qua", không báo.
 */
export const FRESH_MS = 2 * 60_000

export interface NotifyState {
  /** trạng thái gần nhất của từng máy (khóa deviceId) */
  lastState: Map<string, DeviceState>
  /** lần báo gần nhất của từng loại cảnh báo (ms) */
  lastShown: Map<string, number>
}

export const newNotifyState = (): NotifyState => ({ lastState: new Map(), lastShown: new Map() })

/**
 * Trả về loại cảnh báo cần báo, hoặc null. Báo khi trạng thái CHUYỂN sang BAD (trước đó không phải BAD),
 * gói còn mới, và loại đó chưa được báo trong DEBOUNCE_MS. Luôn cập nhật `lastState`; chỉ cập nhật `lastShown` khi báo.
 */
export function evaluateStatus(st: NotifyState, e: StatusEvent, now: number): string | null {
  const prev = st.lastState.get(e.deviceId)
  st.lastState.set(e.deviceId, e.state)
  if (e.state !== 'BAD' || prev === 'BAD') return null
  const ts = Date.parse(e.ts)
  if (Number.isFinite(ts) && now - ts > FRESH_MS) return null
  const type = e.alertType ?? 'UNKNOWN'
  const last = st.lastShown.get(type)
  if (last !== undefined && now - last < DEBOUNCE_MS) return null
  st.lastShown.set(type, now)
  return type
}
