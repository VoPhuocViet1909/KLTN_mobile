// Kiểm tay với backend thật (không nằm trong app): số liệu cho các màn Lịch sử / Thống kê / Cấu hình.
// Chạy:  DEMO_EMAIL=... DEMO_PASSWORD=... node dev/check-data.mjs
// Cần dữ liệu mẫu (GIT_KLTN/api_handover/replay.py) để các kiểm tra "có dữ liệu" có ý nghĩa; không có thì in cảnh báo.
// Với cấu hình: lưu bản gốc, thử PUT một trường, kiểm `personal`, rồi KHÔI PHỤC bản gốc.
import { readFileSync } from 'node:fs'

function apiUrl() {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/+$/, '')
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const m = env.match(/^EXPO_PUBLIC_API_URL=(.+)$/m)
  if (!m) throw new Error('Thiếu API_URL / EXPO_PUBLIC_API_URL')
  return m[1].trim().replace(/\/+$/, '')
}
const BASE = `${apiUrl()}/api/v1`
const { DEMO_EMAIL: email, DEMO_PASSWORD: password } = process.env
if (!email || !password) throw new Error('Cần DEMO_EMAIL và DEMO_PASSWORD')

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

let token = ''
async function call(method, path, { params, body } = {}) {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)) : ''
  const res = await fetch(`${BASE}${path}${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await res.text()
  return { status: res.status, body: t ? JSON.parse(t) : null }
}

// Giống src/lib/time.ts
const DAY = 86_400_000
const VN = 7 * 3_600_000
const lastDays = (d, now = new Date()) => ({ from: new Date(now - d * DAY).toISOString(), to: now.toISOString() })
const vnDayStarts = (days, now = new Date()) => {
  const today = Math.floor((now.getTime() + VN) / DAY) * DAY - VN
  return Array.from({ length: days + 1 }, (_, i) => new Date(today - (days - i) * DAY).toISOString())
}

const login = await call('POST', '/auth/login', { body: { email, password, deviceName: 'Mobile App', deviceId: 'mobile-dev-check-data' } })
check('login', login.status === 200, `status ${login.status}`)
token = login.body.accessToken

// ---- Thống kê ----
for (const days of [7, 30]) {
  const ts = await call('GET', '/stats/me/timeseries', { params: { ...lastDays(days), bucket: 'day' } })
  const ok = ts.status === 200 && Array.isArray(ts.body)
  check(`timeseries ${days} ngày: 200 + mảng`, ok, `status ${ts.status}, ${ts.body?.length} bucket có dữ liệu`)
  if (ok) {
    const starts = new Set(vnDayStarts(days))
    const stray = ts.body.filter((b) => !starts.has(new Date(b.start).toISOString()))
    check(`timeseries ${days} ngày: mọi bucket khớp mốc 00:00 giờ VN (điền đủ ngày được)`, stray.length === 0, stray.length ? `lệch: ${stray[0].start}` : '')
    const filled = vnDayStarts(days).length
    check(`điền đủ ${days + 1} ngày`, filled === days + 1, `${ts.body.length} ngày có dữ liệu, ${filled - ts.body.length} ngày trống`)
    if (ts.body.length === 0) console.log('WARN  không có dữ liệu: chạy replay.py trước để kiểm số liệu')
  }
}
for (const weeks of [1, 4, 12]) {
  const hm = await call('GET', '/stats/me/heatmap', { params: { weeks } })
  const cells = hm.body
  const keys = new Set((cells ?? []).map((c) => `${c.weekday}-${c.hour}`))
  check(`heatmap ${weeks} tuần: đúng 168 ô, weekday 1–7, hour 0–23, không trùng`,
    hm.status === 200 && cells.length === 168 && keys.size === 168 && cells.every((c) => c.weekday >= 1 && c.weekday <= 7 && c.hour >= 0 && c.hour <= 23),
    `status ${hm.status}, ${cells?.length} ô, ${cells?.filter((c) => c.meanScore !== null).length} ô có điểm`)
}

// ---- Lịch sử: phân trang ----
const range = lastDays(92)
const first = await call('GET', '/alerts/me', { params: { ...range, page: 0, size: 20 } })
check('alerts page 0: 200 + {items,page,size,total}', first.status === 200 && Array.isArray(first.body?.items) && first.body.page === 0 && first.body.size === 20, `total ${first.body?.total}`)
if (first.status === 200) {
  const total = first.body.total
  const seen = []
  for (let p = 0; p * 20 < total; p++) {
    const r = await call('GET', '/alerts/me', { params: { ...range, page: p, size: 20 } })
    seen.push(...r.body.items)
  }
  const ids = new Set(seen.map((a) => `${a.sessionId}|${a.deviceId}|${a.alertType}|${a.startedAt}`))
  check('cuộn hết các trang: đủ total mục, khóa danh sách không trùng', seen.length === total && ids.size === total, `${seen.length}/${total}, ${ids.size} khóa duy nhất`)
  const beyond = await call('GET', '/alerts/me', { params: { ...range, page: Math.ceil(total / 20) + 1, size: 20 } })
  check('trang vượt cuối: rỗng, không lỗi', beyond.status === 200 && beyond.body.items.length === 0)
  const typed = await call('GET', '/alerts/me', { params: { ...range, alertType: 'NECK_TRUNK', page: 0, size: 20 } })
  check('lọc alertType=NECK_TRUNK: chỉ trả đúng loại', typed.status === 200 && typed.body.items.every((a) => a.alertType === 'NECK_TRUNK'), `${typed.body?.total} mục`)
}
const sess = await call('GET', '/alerts/me/sessions', { params: { ...range, page: 0, size: 20 } })
check('sessions page 0: 200', sess.status === 200 && Array.isArray(sess.body?.items), `total ${sess.body?.total}`)
const tooLong = await call('GET', '/alerts/me', { params: { ...lastDays(93), page: 0, size: 20 } })
check('khoảng > 92 ngày bị từ chối (app chỉ cho chọn tối đa 92)', tooLong.status === 400, `status ${tooLong.status}`)

// ---- Cấu hình: PUT một trường, personal chỉ đổi đúng trường đó, rồi khôi phục ----
const before = (await call('GET', '/config/me/details')).body
check('config details có personal/organization/effective', !!before?.personal && !!before?.organization && !!before?.effective)
const original = before.personal
const target = 'alert_sec'
const newValue = original[target] === 7 ? 8 : 7
const put = await call('PUT', '/config/me', { body: { ...original, [target]: newValue } })
check('PUT /config/me (giữ khóa cũ + đổi alert_sec)', put.status === 200, `status ${put.status}`)
const after = (await call('GET', '/config/me/details')).body
const changed = Object.keys({ ...original, ...after.personal }).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(after.personal[k]))
check('personal chỉ đổi đúng alert_sec', changed.length === 1 && changed[0] === target && after.personal[target] === newValue, `khóa đổi: ${changed.join(', ') || '(không)'}`)
check('organization không đổi', JSON.stringify(before.organization) === JSON.stringify(after.organization))
const bad = await call('PUT', '/config/me', { body: { ...original, alert_sec: 9999 } })
check('alert_sec=9999 bị 400 VALIDATION_FAILED có errors theo trường', bad.status === 400 && bad.body?.code === 'VALIDATION_FAILED' && (bad.body.errors ?? []).some((e) => String(e.field).endsWith('alert_sec')), JSON.stringify(bad.body?.errors))
const restore = await call('PUT', '/config/me', { body: original })
const restored = (await call('GET', '/config/me/details')).body
check('khôi phục cấu hình gốc', restore.status === 200 && JSON.stringify(Object.entries(restored.personal).sort()) === JSON.stringify(Object.entries(original).sort()))

await call('POST', '/auth/logout', { body: { refreshToken: login.body.refreshToken } })
console.log(failed === 0 ? '\nTẤT CẢ ĐẠT' : `\n${failed} KIỂM TRA HỎNG`)
process.exit(failed === 0 ? 0 : 1)
