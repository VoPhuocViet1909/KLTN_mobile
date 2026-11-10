// Kiểm tay với backend thật (không nằm trong app): login -> refresh -> /stats/me/summary -> Socket.IO không Origin.
// Chạy:  DEMO_EMAIL=... DEMO_PASSWORD=... node dev/check-backend.mjs
// API_URL lấy từ biến môi trường API_URL hoặc file .env (EXPO_PUBLIC_API_URL). Dùng IP LAN, không dùng localhost.
import { readFileSync } from 'node:fs'
import { io } from 'socket.io-client'

function apiUrl() {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/+$/, '')
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const m = env.match(/^EXPO_PUBLIC_API_URL=(.+)$/m)
  if (!m) throw new Error('Thiếu API_URL / EXPO_PUBLIC_API_URL')
  return m[1].trim().replace(/\/+$/, '')
}

const API = apiUrl()
const BASE = `${API}/api/v1`
const email = process.env.DEMO_EMAIL
const password = process.env.DEMO_PASSWORD
if (!email || !password) throw new Error('Cần DEMO_EMAIL và DEMO_PASSWORD')

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function post(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

function connectSocket(token, { origin } = {}) {
  return new Promise((resolve) => {
    const socket = io(API, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: 8000,
      ...(origin ? { extraHeaders: { Origin: origin } } : {}),
    })
    socket.on('connect', () => resolve({ ok: true, socket }))
    socket.on('connect_error', (err) => {
      socket.close()
      resolve({ ok: false, message: err.message })
    })
  })
}

console.log(`Gateway: ${API}`)

// 1. login
const login = await post('/auth/login', { email, password, deviceName: 'Mobile App', deviceId: 'mobile-dev-check' })
check('login 200 có accessToken/refreshToken/user', login.status === 200 && !!login.body?.accessToken && !!login.body?.refreshToken && !!login.body?.user, `status ${login.status}, role ${login.body?.user?.role}`)
const wrong = await post('/auth/login', { email, password: password + 'x' })
check('sai mật khẩu -> 401 AUTH_INVALID_CREDENTIALS', wrong.status === 401 && wrong.body?.code === 'AUTH_INVALID_CREDENTIALS', `${wrong.status} ${wrong.body?.code}`)

// 2. refresh (dùng một lần)
const r1 = await post('/auth/refresh', { refreshToken: login.body.refreshToken })
check('refresh 200 trả cặp token mới', r1.status === 200 && !!r1.body?.accessToken && r1.body.refreshToken !== login.body.refreshToken, `status ${r1.status}`)
const replay = await post('/auth/refresh', { refreshToken: login.body.refreshToken })
check('refresh token cũ dùng lại -> 401 AUTH_INVALID_REFRESH_TOKEN', replay.status === 401 && replay.body?.code === 'AUTH_INVALID_REFRESH_TOKEN', `${replay.status} ${replay.body?.code}`)
const token = r1.body.accessToken

// 3. /auth/me và /stats/me/summary (từ 00:00 giờ Việt Nam hôm nay)
const meRes = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
const me = await meRes.json()
check('GET /auth/me 200', meRes.status === 200 && me.id === login.body.user.id, `${meRes.status}`)

const DAY = 86400000
const OFF = 7 * 3600000
const now = Date.now()
const from = new Date(Math.floor((now + OFF) / DAY) * DAY - OFF).toISOString()
const to = new Date(now).toISOString()
const sumRes = await fetch(`${BASE}/stats/me/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: { Authorization: `Bearer ${token}` } })
const summary = await sumRes.json()
const shapeOk = sumRes.status === 200 && 'meanScore' in summary && typeof summary.badMinutes === 'number' && typeof summary.presenceMinutes === 'number' && typeof summary.alerts === 'object'
check('GET /stats/me/summary (hôm nay) đúng dạng', shapeOk, `${sumRes.status} ${JSON.stringify(summary)}`)

// 4. Socket.IO: websocket, KHÔNG gửi header Origin (giống app native)
const good = await connectSocket(token)
check('Socket.IO websocket, không Origin, token đúng -> kết nối được', good.ok, good.ok ? `id ${good.socket.id}` : good.message)
if (good.ok) {
  // chờ vài giây xem server có đẩy `status` ban đầu không (không bắt buộc)
  const got = await new Promise((res) => {
    good.socket.on('status', (e) => res(e))
    setTimeout(() => res(null), 2500)
  })
  console.log(`INFO  sự kiện status ban đầu: ${got ? JSON.stringify(got) : 'không có (chưa có máy nào gửi dữ liệu)'}`)
  good.socket.close()
}
const bad = await connectSocket('token-sai')
check('Socket.IO không Origin, token sai -> connect_error unauthorized', !bad.ok && bad.message === 'unauthorized', bad.message ?? 'đã kết nối (sai!)')
const evil = await connectSocket(token, { origin: 'http://evil.example' })
console.log(`INFO  Origin lạ http://evil.example + token đúng: ${evil.ok ? 'ĐƯỢC NHẬN' : 'bị từ chối (' + evil.message + ')'}`)
if (evil.ok) evil.socket.close()

// 5. logout
const out = await post('/auth/logout', { refreshToken: r1.body.refreshToken }, token)
check('logout 204', out.status === 204, `${out.status}`)

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} đạt`)
process.exit(failed ? 1 : 0)
