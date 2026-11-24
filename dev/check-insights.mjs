// Kiểm API "Nguy cơ sức khỏe" với backend thật + hàm thuần của app (không cần Expo):
//   DEMO_EMAIL=... DEMO_PASSWORD=... node --experimental-strip-types dev/check-insights.mjs
// API_URL lấy từ biến môi trường API_URL hoặc file .env (EXPO_PUBLIC_API_URL); dùng IP LAN, không dùng localhost.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DISCLAIMER, barPercent, formatIndicator, noteLabel, sortRisks, sourceHref } from '../src/lib/healthRisk.ts'
import { CLASS_LABEL, POSTURE_CLASSES, STACK_ORDER, chartRows, classCoverage, classShares, isPostureClass, topBadClass } from '../src/lib/postureClass.ts'

function apiUrl() {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/+$/, '')
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const m = env.match(/^EXPO_PUBLIC_API_URL=(.+)$/m)
  if (!m) throw new Error('Thiếu API_URL / EXPO_PUBLIC_API_URL')
  return m[1].trim().replace(/\/+$/, '')
}

const BASE = `${apiUrl()}/api/v1`
const email = process.env.DEMO_EMAIL
const password = process.env.DEMO_PASSWORD
if (!email || !password) throw new Error('Cần DEMO_EMAIL và DEMO_PASSWORD')

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

// ---- hàm thuần của app
const risk = (kbId, level) => ({ kbId, level })
assert.deepEqual(sortRisks([risk('B', 'LOW'), risk('A', 'HIGH')]).map((r) => r.kbId), ['A', 'B'])
assert.equal(formatIndicator('tooCloseRatio', 0.126), '13%')
assert.equal(formatIndicator('badRatio', null), 'Chưa đo')
assert.equal(barPercent({ key: 'tooCloseRatio', label: 'x', value: 0.125, mediumGte: 0.1, highGte: 0.25 }), 50)
assert.equal(sourceHref({ doi: null, url: 'javascript:alert(1)' }), null)
assert.match(noteLabel('no_api_key'), /Chưa bật AI/)
check('hàm thuần của app (sắp xếp, định dạng, thanh chỉ số, liên kết an toàn)', true)


// ---- hàm thuần của biểu đồ lớp tư thế
const zero = () => Object.fromEntries(POSTURE_CLASSES.map((c) => [c, 0]))
const secs = (o) => ({ ...zero(), ...o })
assert.deepEqual([...POSTURE_CLASSES].sort(), [...STACK_ORDER].sort())
assert.equal(CLASS_LABEL.SLOUCH, 'Gù lưng')
assert.equal(isPostureClass('WEIRD'), false)
const totalsDemo = secs({ GOOD: 600, SLOUCH: 300, FORWARD_HEAD: 100 })
assert.equal(classShares(totalsDemo)[0].posture, 'SLOUCH')
assert.equal(classShares(totalsDemo).at(-1).posture, 'GOOD')
assert.equal(topBadClass(totalsDemo), 'SLOUCH')
assert.equal(topBadClass(secs({ GOOD: 5 })), null)
assert.deepEqual(classShares(zero()), [])
const day = (d) => new Date(Date.UTC(2026, 10, d, 17)).toISOString()
const rowsDemo = chartRows([{ start: day(14), seconds: secs({ GOOD: 120, SLOUCH: 60 }), presenceSec: 300 }], [day(13), day(14)])
assert.equal(rowsDemo[0].minutes.GOOD, 0)
assert.equal(rowsDemo[1].minutes.SLOUCH, 1)
assert.equal(classCoverage({ classSec: 30, presenceSec: 60 }), 0.5)
check('hàm thuần của biểu đồ lớp tư thế (phân bố, lớp xấu nổi bật, điền ngày trống, độ phủ)', true)

// ---- API thật
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, deviceName: 'Mobile App', deviceId: 'mobile-dev-check-insights' }),
})
const session = await login.json()
check('login 200', login.status === 200 && !!session.accessToken, `status ${login.status}, role ${session.user?.role}`)
const token = session.accessToken

const anon = await get('/insights/me/health-risks')
check('không JWT -> 401', anon.status === 401, String(anon.status))

const kb = await get('/insights/knowledge', token)
const entries = kb.body?.entries ?? []
check('GET /insights/knowledge 200, có phiên bản, câu miễn trừ, nguồn', kb.status === 200 && /^\d+\.\d+\.\d+$/.test(kb.body?.kbVersion ?? '')
  && kb.body.disclaimer.includes('không phải chẩn đoán y khoa') && entries.length > 0 && entries.every((e) => e.sources?.length > 0),
  `v${kb.body?.kbVersion}, ${entries.length} mục`)

for (const period of ['7d', '30d']) {
  const r = await get(`/insights/me/health-risks?period=${period}`, token)
  const b = r.body
  check(`GET /insights/me/health-risks?period=${period} 200, đủ trường`, r.status === 200 && b.period === period
    && ['OK', 'INSUFFICIENT_DATA'].includes(b.status) && b.disclaimer.includes(DISCLAIMER.split(';')[0]) && b.risks.length === entries.length
    && ['gemini', 'template'].includes(b.explanationSource), `status ${b.status}, nguồn giải thích ${b.explanationSource}`)
  check(`  ${period}: mỗi nguy cơ có mức hợp lệ, chỉ số, nguồn; bằng chứng yếu không ra HIGH`, b.risks.every((x) =>
    ['LOW', 'MEDIUM', 'HIGH', 'INSUFFICIENT_DATA'].includes(x.level) && Array.isArray(x.indicators) && x.sources.length > 0
    && !(x.evidence === 'weak' && x.level === 'HIGH')))
  const top = sortRisks(b.risks)[0]
  console.log(`      cao nhất: ${top.risk.vi} — ${top.level}`)
}


// ---- lớp tư thế qua backend thật
for (const bucket of ['day', 'week']) {
  const r = await get(`/stats/me/posture-classes?bucket=${bucket}&from=${encodeURIComponent(new Date(Date.now() - 28 * 864e5).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`, token)
  const b = r.body
  check(`GET /stats/me/posture-classes?bucket=${bucket} 200, đủ 6 lớp, điểm khớp tổng`, r.status === 200 && b.bucket === bucket
    && JSON.stringify(b.classes) === JSON.stringify(POSTURE_CLASSES) && POSTURE_CLASSES.every((c) => typeof b.totals[c] === 'number')
    && b.points.every((p) => POSTURE_CLASSES.every((c) => typeof p.seconds[c] === 'number'))
    && POSTURE_CLASSES.every((c) => Math.abs(b.points.reduce((a, p) => a + p.seconds[c], 0) - b.totals[c]) < 0.05),
    `classSec ${Math.round(b.classSec ?? -1)} / presenceSec ${Math.round(b.presenceSec ?? -1)}, ${b.points?.length} điểm`)
}
const badBucket = await get('/stats/me/posture-classes?bucket=hour', token)
check('bucket=hour -> 400 VALIDATION_FAILED', badBucket.status === 400 && badBucket.body?.code === 'VALIDATION_FAILED', String(badBucket.status))
const anonClasses = await get('/stats/me/posture-classes')
check('posture-classes không JWT -> 401', anonClasses.status === 401, String(anonClasses.status))
const mine7 = (await get('/insights/me/health-risks?period=7d', token)).body
const neck = mine7?.risks?.find((x) => x.kbId === 'HK-NECK-FHP')
check('thẻ HK-NECK-FHP có postureClasses {available, classes, top}; có lớp thì top là một lớp hợp lệ', !!neck?.postureClasses
  && typeof neck.postureClasses.available === 'boolean' && Array.isArray(neck.postureClasses.classes)
  && (!neck.postureClasses.available || neck.postureClasses.top === null || isPostureClass(neck.postureClasses.top.posture)),
  `available ${neck?.postureClasses?.available}, top ${neck?.postureClasses?.top?.posture ?? 'không'}`)

const bad = await get('/insights/me/health-risks?period=1y', token)
check('period=1y -> 400 VALIDATION_FAILED', bad.status === 400 && bad.body?.code === 'VALIDATION_FAILED', String(bad.status))
if (session.user?.role === 'USER') {
  const org = await get('/insights/org/health-risks', token)
  check('USER gọi /insights/org/health-risks -> 403', org.status === 403 && org.body?.code === 'AUTH_FORBIDDEN', String(org.status))
}

console.log(`\n${pass} đạt, ${fail} lỗi`)
process.exit(fail ? 1 : 0)
