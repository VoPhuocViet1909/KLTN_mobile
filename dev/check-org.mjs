// Kiểm màn "Tổ chức" với backend thật (không nằm trong app): 2 tổ chức, dữ liệu từ replay.py, phân quyền và Socket.IO.
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node dev/check-org.mjs
// ADMIN_* = tài khoản SYS_ADMIN (AUTH_SEED_ADMIN_* trong .env của backend). Cần python trên PATH và Node 22.
// Script tạo 2 tổ chức + người dùng thử (mật khẩu ngẫu nhiên, không in ra) rồi khóa chúng khi xong.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { io } from 'socket.io-client'

function apiUrl() {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/+$/, '')
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  return env.match(/^EXPO_PUBLIC_API_URL=(.+)$/m)[1].trim().replace(/\/+$/, '')
}
const API = apiUrl()
const BASE = `${API}/api/v1`
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Cần ADMIN_EMAIL và ADMIN_PASSWORD (SYS_ADMIN)')

const tag = randomUUID().slice(0, 8)
const fixturePassword = `Aa1-${randomUUID()}`
let passed = 0
const check = (name, cond, detail = '') => {
  assert.ok(cond, `${name}${detail ? ' — ' + detail : ''}`)
  passed++
  console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`)
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}
async function must(token, method, path, body, expected = 200) {
  const r = await call(token, method, path, body)
  assert.equal(r.status, expected, `${method} ${path}: HTTP ${r.status} (cần ${expected}) ${JSON.stringify(r.body)}`)
  return r.body
}
const range = (days) => {
  const to = new Date()
  return `from=${encodeURIComponent(new Date(to - days * 864e5).toISOString())}&to=${encodeURIComponent(to.toISOString())}`
}

const created = []
async function createUser(root, role, orgId, label) {
  const email = `mobile-${tag}-${label}@example.com`
  const u = await must(root, 'POST', '/users', { email, password: fixturePassword, role, orgId, name: label }, 201)
  const login = await must(null, 'POST', '/auth/login', { email, password: fixturePassword, deviceName: 'check-org' })
  const user = { ...u, email, token: login.accessToken, deviceId: `mobile-check-${tag}-${label}` }
  created.push(user)
  return user
}

function replayScript() {
  const c = [process.env.REPLAY_PY, fileURLToPath(new URL('../../GIT_KLTN/api_handover/replay.py', import.meta.url))].filter(Boolean)
  const f = c.find(existsSync)
  assert.ok(f, `không thấy replay.py (thử ${c.join(', ')})`)
  return f
}
async function seed(user, seedNo) {
  const { stdout } = await promisify(execFile)(
    process.env.PYTHON || 'python',
    [replayScript(), 'seed', '--base', API, '--email', user.email, '--password', fixturePassword, '--devices', '1', '--days', '2', '--seed', String(seedNo)],
    { timeout: 180000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } },
  )
  assert.match(stdout, /rejected 0, lô lỗi 0/, `replay.py seed ${user.email}: ${stdout.trim().split('\n').pop()}`)
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const events = []
    const socket = io(API, { path: '/socket.io', transports: ['websocket'], auth: { token }, reconnection: false, timeout: 8000 })
    socket.on('status', (e) => events.push(e))
    socket.on('connect', () => resolve({ socket, events }))
    socket.on('connect_error', (e) => reject(new Error(`socket: ${e.message}`)))
  })
}

console.log(`Gateway: ${API}  tag: ${tag}`)
const rootLogin = await must(null, 'POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
const root = rootLogin.accessToken
const orgs = {}
try {
  // ---- dựng 2 tổ chức: Alpha và Beta, mỗi nơi 1 ORG_ADMIN + 2 nhân viên
  for (const name of ['Alpha', 'Beta']) {
    const org = await must(root, 'POST', '/organizations', { name: `Mobile ${tag} ${name}` }, 201)
    orgs[name] = { org, admin: await createUser(root, 'ORG_ADMIN', org.id, `${name}-admin`), users: [] }
    for (const i of [1, 2]) orgs[name].users.push(await createUser(root, 'USER', org.id, `${name}-u${i}`))
  }
  const { Alpha, Beta } = orgs
  const seedBase = Math.floor(Date.now() / 1000) % 1_000_000
  await Promise.all([...Alpha.users, ...Beta.users].map((u, i) => seed(u, seedBase + i * 17)))
  console.log('INFO  replay.py seed xong cho 4 nhân viên (2 ngày dữ liệu mỗi người)')

  // chờ dữ liệu replay được xử lý xong: tổng có mặt của 2 tổ chức không đổi qua 3 lần đọc liên tiếp (mỗi 1,5 giây)
  const totalPresence = async () => {
    const r = await Promise.all([Alpha, Beta].map((o) => must(o.admin.token, 'GET', `/stats/org/members?${range(7)}`)))
    return { members: r[1], alpha: r[0], total: [...r[0], ...r[1]].reduce((s, m) => s + m.presenceMinutes, 0), count: r[0].length + r[1].length }
  }
  let membersBeta
  let last = -1
  let stable = 0
  for (let i = 0; i < 80 && stable < 3; i++) {
    const cur = await totalPresence()
    membersBeta = cur.members
    stable = cur.count === 4 && cur.total === last ? stable + 1 : 0
    last = cur.total
    await delay(1500)
  }
  check('ORG_ADMIN Beta thấy đúng 2 nhân viên có số liệu (dữ liệu đã ổn định)', membersBeta.length === 2 && stable >= 3)

  // ---- cách ly tổ chức
  const betaIds = new Set(Beta.users.map((u) => u.id))
  const alphaIds = new Set(Alpha.users.map((u) => u.id))
  check('/stats/org/members của Beta chỉ chứa nhân viên Beta', membersBeta.every((m) => betaIds.has(m.userId)))
  const alphaMembers = await must(Alpha.admin.token, 'GET', `/stats/org/members?${range(7)}`)
  check('/stats/org/members của Alpha chỉ chứa nhân viên Alpha', alphaMembers.every((m) => alphaIds.has(m.userId)))

  const summaryBeta = await must(Beta.admin.token, 'GET', `/stats/org/summary?${range(7)}`)
  const sumPresence = membersBeta.reduce((s, m) => s + m.presenceMinutes, 0)
  const sumBad = membersBeta.reduce((s, m) => s + m.badMinutes, 0)
  check('summary tổ chức Beta = tổng các nhân viên Beta (có mặt, ngồi sai)',
    Math.abs(summaryBeta.presenceMinutes - sumPresence) < 0.5 && Math.abs(summaryBeta.badMinutes - sumBad) < 0.5,
    `có mặt ${summaryBeta.presenceMinutes.toFixed(1)} / ${sumPresence.toFixed(1)}, sai ${summaryBeta.badMinutes.toFixed(1)} / ${sumBad.toFixed(1)}`)
  const seriesBeta = await must(Beta.admin.token, 'GET', `/stats/org/timeseries?${range(7)}&bucket=day`)
  check('/stats/org/timeseries của Beta có dữ liệu theo ngày', Array.isArray(seriesBeta) && seriesBeta.length > 0, `${seriesBeta.length} ngày`)

  const alertsBeta = await must(Beta.admin.token, 'GET', `/alerts/org?${range(7)}&page=0&size=100`)
  check('/alerts/org của Beta chỉ chứa cảnh báo nhân viên Beta', alertsBeta.items.length > 0 && alertsBeta.items.every((a) => betaIds.has(a.userId)), `${alertsBeta.total} cảnh báo`)
  const own = await must(Beta.admin.token, 'GET', `/alerts/org?${range(7)}&userId=${Beta.users[0].id}&size=100`)
  check('/alerts/org?userId= chỉ giữ một nhân viên', own.items.every((a) => a.userId === Beta.users[0].id), `${own.total} cảnh báo`)
  const cross = await must(Beta.admin.token, 'GET', `/alerts/org?${range(7)}&userId=${Alpha.users[0].id}`)
  check('ORG_ADMIN Beta xem userId của Alpha: trang rỗng (không lộ dữ liệu)', cross.items.length === 0 && cross.total === 0)
  const usersBeta = await must(Beta.admin.token, 'GET', '/users?page=0&size=100')
  check('GET /users của Beta chỉ có người Beta (tra tên)', usersBeta.items.length === 3 && usersBeta.items.every((u) => u.orgId === Beta.org.id))

  // ---- USER nhận 403 ở mọi API tổ chức
  for (const path of [`/stats/org/summary?${range(7)}`, `/stats/org/timeseries?${range(7)}&bucket=day`, `/stats/org/members?${range(7)}`, `/alerts/org?${range(7)}`, '/users?page=0&size=10']) {
    const r = await call(Beta.users[0].token, 'GET', path)
    check(`USER nhận 403 ở ${path.split('?')[0]}`, r.status === 403 && r.body?.code === 'AUTH_FORBIDDEN', `${r.status} ${r.body?.code}`)
  }

  // ---- Socket.IO: ORG_ADMIN nhận `status` BAD của nhân viên trong tổ chức mình, không nhận của tổ chức khác
  const adminBetaSock = await connect(Beta.admin.token)
  const adminAlphaSock = await connect(Alpha.admin.token)
  const userSock = await connect(Beta.users[0].token)
  const samples = fileURLToPath(new URL('../../GIT_KLTN/api_handover/sample_data/', import.meta.url))
  const metricT = JSON.parse(readFileSync(samples + 'p01_metrics.jsonl', 'utf8').split('\n')[0])
  const eventT = readFileSync(samples + 'p01_events.jsonl', 'utf8').trim().split('\n').map(JSON.parse)
  const dev = Beta.users[0].deviceId
  const sessionId = `mobile-check-${tag}`
  const now = Date.now()
  const events = ['SESSION_START', 'ALERT_STARTED'].map((kind, j) => ({
    ...eventT.find((e) => e.eventType === kind), eventId: randomUUID(), userId: null, deviceId: dev, sessionId,
    ts: new Date(now - 2000 + j * 1000).toISOString(),
    ...(kind === 'ALERT_STARTED' ? { startedAt: new Date(now - 1000).toISOString(), alertType: 'NECK_TRUNK' } : {}),
  }))
  const metric = { ...metricT, metricId: randomUUID(), userId: null, deviceId: dev, sessionId, windowStart: new Date(now - 60000).toISOString(), windowSec: 60, coveredSec: 60, samples: 600, presenceSec: 60, goodRatio: 0.7, postureScore: 70, alertCount: { NECK_TRUNK: 1 } }
  const t0 = Date.now()
  const batch = await must(Beta.users[0].token, 'POST', '/telemetry/batch', { schemaVersion: '1.0', sentAt: new Date().toISOString(), deviceId: dev, events, metrics: [metric] })
  check('POST /telemetry/batch nhận hết, không rejected', batch.rejected.length === 0 && batch.accepted.length === 3)
  const isBad = (e) => e.deviceId === dev && e.state === 'BAD'
  for (let i = 0; i < 40 && !adminBetaSock.events.some(isBad); i++) await delay(100)
  const got = adminBetaSock.events.find(isBad)
  check('ORG_ADMIN Beta nhận `status` BAD của nhân viên Beta qua room org', !!got && got.userId === Beta.users[0].id && got.alertType === 'NECK_TRUNK', got ? `sau ${Date.now() - t0} ms` : 'không nhận')
  check('chính nhân viên cũng nhận `status` BAD (room user)', userSock.events.some(isBad))
  await delay(1500)
  check('ORG_ADMIN Alpha KHÔNG nhận `status` của tổ chức Beta', !adminAlphaSock.events.some((e) => e.deviceId === dev))
  for (const s of [adminBetaSock, adminAlphaSock, userSock]) s.socket.close()
} finally {
  // khóa dữ liệu thử
  for (const u of created) await call(root, 'PATCH', `/users/${u.id}/status`, { enabled: false }).catch(() => {})
  for (const o of Object.values(orgs)) await call(root, 'PATCH', `/organizations/${o.org.id}/status`, { active: false }).catch(() => {})
  console.log('INFO  đã khóa người dùng thử và tạm ngưng 2 tổ chức thử')
}
console.log(`\n${passed} kiểm tra đạt`)
