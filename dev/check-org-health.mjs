// Kiểm "Nguy cơ sức khỏe tổ chức", báo cáo phòng ban theo tuần và heatmap tổ chức với backend thật:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node --experimental-strip-types dev/check-org-health.mjs
// ADMIN_* = tài khoản SYS_ADMIN (AUTH_SEED_ADMIN_* trong .env của backend). Cần python trên PATH và Node 22+.
// Dựng 2 tổ chức: Alpha (phòng A1, 2 nhân viên => nhóm < 3 người) và Beta (phòng B1, 3 nhân viên), nạp dữ liệu bằng
// GIT_KLTN/api_handover/replay.py, kiểm cách ly, phân quyền, SUPPRESSED và phạm vi tuần; xong thì khóa dữ liệu thử.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { defaultReportWeek, oldestReportWeek, shiftWeek, vnWeekStart } from '../src/lib/week.ts'

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

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}
async function must(token, method, path, body, expected = 200) {
  const r = await call(token, method, path, body)
  assert.equal(r.status, expected, `${method} ${path}: HTTP ${r.status} (cần ${expected}) ${JSON.stringify(r.body)}`)
  return r.body
}

const created = []
async function createUser(root, role, orgId, label, departmentId) {
  const email = `mobile-oh-${tag}-${label}@example.com`
  const u = await must(root, 'POST', '/users', { email, password: fixturePassword, role, orgId, name: label, ...(departmentId ? { departmentId } : {}) }, 201)
  const login = await must(null, 'POST', '/auth/login', { email, password: fixturePassword, deviceName: 'check-org-health' })
  const user = { ...u, email, token: login.accessToken }
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

console.log(`Gateway: ${API}  tag: ${tag}`)
const root = (await must(null, 'POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).accessToken
const orgs = {}
try {
  const plan = { Alpha: 2, Beta: 3 }
  for (const [name, count] of Object.entries(plan)) {
    const org = await must(root, 'POST', '/organizations', { name: `MobileOH ${tag} ${name}` }, 201)
    const dept = await must(root, 'POST', `/organizations/${org.id}/departments`, { name: `${name}-phong-1` }, 201)
    const admin = await createUser(root, 'ORG_ADMIN', org.id, `${name}-admin`)
    const users = []
    for (let i = 1; i <= count; i++) users.push(await createUser(root, 'USER', org.id, `${name}-u${i}`, dept.id))
    orgs[name] = { org, dept, admin, users }
  }
  const { Alpha, Beta } = orgs
  const seedBase = Math.floor(Date.now() / 1000) % 1_000_000
  await Promise.all([...Alpha.users, ...Beta.users].map((u, i) => seed(u, seedBase + i * 17)))
  console.log('INFO  replay.py seed xong cho 5 nhân viên (2 ngày dữ liệu mỗi người)')
  await new Promise((r) => setTimeout(r, 8000)) // chờ analytics xử lý xong

  // ---- nguy cơ sức khỏe tổ chức
  const betaAll = await must(Beta.admin.token, 'GET', '/insights/org/health-risks?period=7d')
  check('Beta (3 người đủ dữ liệu) trả OK, có groupSize và minGroupSize', betaAll.status === 'OK' && betaAll.groupSize === 3 && betaAll.minGroupSize >= 1,
    `status ${betaAll.status}, groupSize ${betaAll.groupSize}, minGroupSize ${betaAll.minGroupSize}`)
  check('nguy cơ Beta chỉ có số đếm low/medium/high', betaAll.risks.length > 0 && betaAll.risks.every((r) => ['low', 'medium', 'high'].every((k) => Number.isInteger(r[k]))))
  const alphaAll = await must(Alpha.admin.token, 'GET', '/insights/org/health-risks?period=7d')
  check('Alpha (2 người, nhóm < 3) ra SUPPRESSED, không lộ groupSize hay risks', alphaAll.status === 'SUPPRESSED' && alphaAll.groupSize === null && alphaAll.risks.length === 0,
    `status ${alphaAll.status}`)
  const alphaDept = await must(Alpha.admin.token, 'GET', `/insights/org/health-risks?period=30d&departmentId=${Alpha.dept.id}`)
  check('phòng ban Alpha (2 người) ra SUPPRESSED', alphaDept.status === 'SUPPRESSED' && alphaDept.groupSize === null)
  const cross = await call(Beta.admin.token, 'GET', `/insights/org/health-risks?period=7d&departmentId=${Alpha.dept.id}`)
  check('ORG_ADMIN Beta hỏi phòng ban của Alpha: không thấy dữ liệu Alpha', cross.status !== 200 || (cross.body.status === 'SUPPRESSED' && cross.body.groupSize === null),
    `HTTP ${cross.status} ${cross.body?.status ?? cross.body?.code ?? ''}`)
  const badPeriod = await call(Beta.admin.token, 'GET', '/insights/org/health-risks?period=90d')
  check('period sai bị 400', badPeriod.status === 400, `HTTP ${badPeriod.status}`)

  // ---- báo cáo phòng ban theo tuần
  const now = new Date()
  const week = defaultReportWeek(now)
  const reportBeta = await must(Beta.admin.token, 'GET', `/stats/org/departments/report?week=${week}`)
  check('báo cáo tuần mặc định (tuần trước) của Beta trả đúng tuần', reportBeta.week === week && typeof reportBeta.minimumGroupSize === 'number', `week ${reportBeta.week}, status ${reportBeta.status}`)
  const noWeek = await must(Beta.admin.token, 'GET', '/stats/org/departments/report')
  check('không truyền week: backend mặc định đúng tuần mà app chọn', noWeek.week === week, `${noWeek.week} / ${week}`)
  for (const [who, mine, other] of [['Alpha', Alpha, Beta], ['Beta', Beta, Alpha]]) {
    const r = await must(mine.admin.token, 'GET', `/stats/org/departments/report?week=${week}`)
    check(`báo cáo ${who} không chứa phòng ban của tổ chức kia`, !r.rows.some((x) => x.departmentId === other.dept.id))
  }
  const oldest = oldestReportWeek(now)
  const okOldest = await call(Beta.admin.token, 'GET', `/stats/org/departments/report?week=${oldest}`)
  check('tuần cũ nhất app cho chọn (13 tuần trước) vẫn được backend nhận', okOldest.status === 200, `HTTP ${okOldest.status}`)
  const tooOld = await call(Beta.admin.token, 'GET', `/stats/org/departments/report?week=${shiftWeek(oldest, -1)}`)
  check('tuần ngoài 13 tuần bị 400', tooOld.status === 400, `HTTP ${tooOld.status} ${tooOld.body?.code}`)
  const current = await call(Beta.admin.token, 'GET', `/stats/org/departments/report?week=${vnWeekStart(now)}`)
  check('tuần hiện tại (chưa kết thúc) bị 400', current.status === 400, `HTTP ${current.status} ${current.body?.code}`)

  // ---- heatmap tổ chức
  const heat = await must(Beta.admin.token, 'GET', '/stats/org/heatmap?weeks=4')
  check('/stats/org/heatmap trả đúng 168 ô', Array.isArray(heat) && heat.length === 168, `${heat.length} ô`)

  // ---- USER nhận 403 ở mọi API mới
  for (const path of ['/insights/org/health-risks?period=7d', `/stats/org/departments/report?week=${week}`, '/stats/org/heatmap?weeks=4']) {
    const r = await call(Beta.users[0].token, 'GET', path)
    check(`USER nhận 403 ở ${path.split('?')[0]}`, r.status === 403 && r.body?.code === 'AUTH_FORBIDDEN', `${r.status} ${r.body?.code}`)
  }
} finally {
  for (const u of created) await call(root, 'PATCH', `/users/${u.id}/status`, { enabled: false }).catch(() => {})
  for (const o of Object.values(orgs)) await call(root, 'PATCH', `/organizations/${o.org.id}/status`, { active: false }).catch(() => {})
  console.log('INFO  đã khóa người dùng thử và tạm ngưng 2 tổ chức thử')
}
console.log(`\n${passed} kiểm tra đạt`)
