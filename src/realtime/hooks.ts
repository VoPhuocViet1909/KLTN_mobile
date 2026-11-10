// Dựa trên GIT_frontend/src/realtime/hooks.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { getSocket, isRealtimeConnected, onConnectionChange } from './socket'

/** Nghe một sự kiện Socket.IO ('status', 'config'…). Handler mới nhất luôn được dùng. */
export function useRealtimeEvent<T>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    const socket = getSocket()
    const fn = (payload: T) => ref.current(payload)
    socket.on(event, fn)
    return () => {
      socket.off(event, fn)
    }
  }, [event])
}

/** true khi đang kết nối Socket.IO (mở kết nối nếu chưa có). */
export function useRealtimeConnected() {
  useEffect(() => {
    getSocket()
  }, [])
  return useSyncExternalStore(onConnectionChange, isRealtimeConnected)
}
