import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useRealtimeEvent } from './hooks'
import type { StatusEvent } from './socket'

/**
 * Giữ trạng thái `status` mới nhất của từng máy (khóa `userId:deviceId`) ở cấp cao nhất, để đổi tab
 * không làm mất trạng thái (server chỉ gửi lại khi có thay đổi hoặc lúc mới kết nối).
 */
const StatusContext = createContext<Record<string, StatusEvent>>({})

export function StatusProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Record<string, StatusEvent>>({})
  useRealtimeEvent<StatusEvent>('status', (e) => {
    setEvents((prev) => {
      const key = `${e.userId}:${e.deviceId}`
      const old = prev[key]
      // Bỏ qua gói cũ hơn gói đã có (đến muộn / sai thứ tự).
      if (old && old.ts > e.ts) return prev
      return { ...prev, [key]: e }
    })
  })
  const value = useMemo(() => events, [events])
  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>
}

/** Trạng thái các máy của chính user này, mới nhất trước. */
export function useMyDevices(userId: string | undefined): StatusEvent[] {
  const all = useContext(StatusContext)
  return useMemo(
    () => Object.values(all).filter((e) => e.userId === userId).sort((a, b) => b.ts.localeCompare(a.ts)),
    [all, userId],
  )
}

/** Trạng thái mọi máy nhận được trong phòng của mình (ORG_ADMIN: cả tổ chức), khóa `userId:deviceId`. */
export function useAllDevices(): StatusEvent[] {
  const all = useContext(StatusContext)
  return useMemo(() => Object.values(all), [all])
}
