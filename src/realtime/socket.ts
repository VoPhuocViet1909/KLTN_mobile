// Chép từ GIT_frontend/src/realtime/socket.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
// Socket.IO tới notification-service qua Gateway (/socket.io/), theo team-sync mục 4.7:
// - token gửi trong auth lúc kết nối; sai/hết hạn -> connect_error "unauthorized"
// - server ngắt đúng lúc token hết hạn -> client refresh rồi tự kết nối lại
// - server tự cho vào room user:{sub} (ORG_ADMIN thêm org:{orgId}); client không gửi lệnh join
// Khác web: địa chỉ tuyệt đối, chỉ dùng WebSocket (app native không gửi header Origin như trình duyệt).
import { io, type Socket } from 'socket.io-client'
import { API_URL } from '@/api/env'
import { refreshAccessToken } from '@/api/client'
import { tokenStore } from '@/api/tokenStore'

export type DeviceState = 'GOOD' | 'BAD' | 'AWAY' | 'OFFLINE'

export interface StatusEvent {
  userId: string
  deviceId: string
  state: DeviceState
  alertType: string | null
  ts: string
}

type Listener = (connected: boolean) => void

let socket: Socket | null = null
let retryDelay = 1_000
let retryTimer: ReturnType<typeof setTimeout> | null = null
const connectionListeners = new Set<Listener>()

function notify(connected: boolean) {
  connectionListeners.forEach((fn) => fn(connected))
}

function scheduleReconnect() {
  if (retryTimer || !socket) return
  retryTimer = setTimeout(async () => {
    retryTimer = null
    try {
      await refreshAccessToken()
    } catch {
      // Phiên đã hết hẳn: AuthProvider sẽ đưa về màn đăng nhập. Lỗi mạng: thử lại sau.
      if (tokenStore.getRefreshToken()) scheduleReconnect()
      return
    }
    socket?.connect()
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, 30_000)
}

export function getSocket(): Socket {
  if (socket) return socket
  socket = io(API_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    // hàm: mỗi lần (re)connect lấy token mới nhất
    auth: (cb) => cb({ token: tokenStore.getAccessToken() }),
  })
  socket.on('connect', () => {
    retryDelay = 1_000
    notify(true)
  })
  socket.on('disconnect', (reason) => {
    notify(false)
    // Server chủ động ngắt (token hết hạn): thư viện không tự kết nối lại
    if (reason === 'io server disconnect') scheduleReconnect()
  })
  socket.on('connect_error', (err) => {
    notify(false)
    // Bị từ chối xác thực: thư viện cũng không tự thử lại
    if (err.message === 'unauthorized') scheduleReconnect()
  })
  socket.connect()
  return socket
}

export function isRealtimeConnected() {
  return !!socket?.connected
}

export function onConnectionChange(fn: Listener) {
  connectionListeners.add(fn)
  return () => {
    connectionListeners.delete(fn)
  }
}

/**
 * App quay lại foreground: hệ điều hành thường đã cắt WebSocket khi app ở nền và access token có thể đã hết hạn.
 * Nếu socket đang đứt thì refresh token rồi kết nối lại ngay (không chờ lượt thử lại).
 */
export function reconnectIfNeeded() {
  if (!socket || socket.connected) return
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retryDelay = 1_000
  scheduleReconnect()
}

export function disconnectRealtime() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retryDelay = 1_000
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
  notify(false)
}
