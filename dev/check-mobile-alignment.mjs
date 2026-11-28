// Hồi quy client mobile, chạy với Node 24. Gateway HTTP và SecureStore được mô phỏng tại chỗ.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { msUntilNextVnDay, vnToday } from '../src/lib/time.ts'
import { canGoEarlier, canGoLater, defaultReportWeek, formatWeekRange, oldestReportWeek, shiftWeek, vnWeekStart } from '../src/lib/week.ts'
import { badRatioText, hiddenMessage, reportHidden, rowLabel, suppressedHealthMessage } from '../src/lib/departmentReport.ts'
import { uniqueHistoryRows } from '../src/lib/historyRows.ts'
import { currentObservations, latestObservationByUser, newerObservation, validObservation } from '../src/realtime/observation.ts'

const observedAt = '2026-11-26T03:00:00.000Z'
const event = {
  version: 1, userId: 'mine', deviceId: 'desktop-1', sessionId: 'session-1', sequence: 3,
  state: 'CAMERA_LOST', reason: 'CAMERA_READ_FAILED', observedAt, receivedAt: observedAt,
  expiresAt: '2026-11-26T03:00:15.000Z',
}
assert.ok(validObservation(event))
assert.equal(validObservation({ ...event, state: 'GOOD' }), false)
assert.equal(newerObservation({ ...event, sequence: 2 }, event), false)
assert.equal(newerObservation({ ...event, sequence: 4 }, event), true)
assert.equal(newerObservation({ ...event, sessionId: 'session-2', sequence: 1 }, event), true)
assert.deepEqual(currentObservations([event, { ...event, userId: 'other' }], 'mine', Date.parse(observedAt)), [event])
assert.deepEqual(currentObservations([event], 'mine', Date.parse(event.expiresAt)), [])
const otherUser = { ...event, userId: 'other' }
const stopped = { ...event, deviceId: 'desktop-2', state: 'OFFLINE', reason: 'SESSION_STOPPED' }
assert.deepEqual(currentObservations([event, otherUser], 'mine', Date.parse(observedAt), true), [event, otherUser])
assert.equal(latestObservationByUser([stopped, event, otherUser]).get('mine')?.state, 'CAMERA_LOST')
assert.equal(latestObservationByUser([stopped, otherUser]).get('mine')?.state, 'OFFLINE')
console.log('PASS device-state v1, thứ tự, chính chủ và hết hạn')

const alert = { userId: 'mine', deviceId: 'desktop-1', sessionId: 'session-1', alertType: 'NECK_TRUNK', startedAt: observedAt }
const updated = { ...alert, endedAt: '2026-11-26T03:01:00.000Z' }
const otherType = { ...alert, alertType: 'TOO_CLOSE' }
assert.deepEqual(uniqueHistoryRows([{ items: [alert] }, { items: [updated, otherType] }]), [updated, otherType])
console.log('PASS trang cảnh báo chồng nhau không tạo dòng trùng')
// Tuần báo cáo phòng ban: thứ Hai 00:00 giờ Việt Nam (UTC+7)
assert.equal(vnWeekStart(new Date('2026-11-28T05:00:00Z')), '2026-11-23') // Thứ Bảy 28/11 -> Thứ Hai 23/11
assert.equal(vnWeekStart(new Date('2026-11-22T16:59:59Z')), '2026-11-16') // Chủ Nhật 23:59:59 VN vẫn là tuần 16/11
assert.equal(vnWeekStart(new Date('2026-11-22T17:00:00Z')), '2026-11-23') // đúng 00:00 thứ Hai VN sang tuần mới
assert.equal(vnWeekStart(new Date('2026-11-23T00:00:00Z')), '2026-11-23') // thứ Hai 07:00 VN
assert.equal(vnWeekStart(new Date('2026-12-31T20:00:00Z')), '2026-12-28') // 03:00 ngày 1/1/2027 VN (thứ Sáu)
assert.equal(shiftWeek('2026-12-28', 1), '2027-01-04')
assert.equal(shiftWeek('2026-03-02', -1), '2026-02-23')
const nowW = new Date('2026-11-28T05:00:00Z')
assert.equal(defaultReportWeek(nowW), '2026-11-16')
assert.equal(oldestReportWeek(nowW), '2026-08-24') // 13 tuần trước tuần 23/11
assert.equal(canGoEarlier('2026-08-24', nowW), false)
assert.equal(canGoEarlier('2026-08-31', nowW), true)
assert.equal(canGoLater('2026-11-16', nowW), false) // tuần hiện tại chưa kết thúc, không chọn được
assert.equal(canGoLater('2026-11-09', nowW), true)
assert.equal(formatWeekRange('2026-12-28'), '28/12 – 03/01/2027')
assert.equal(formatWeekRange('2026-11-16'), '16/11 – 22/11/2026')
assert.equal(rowLabel({ group: 'UNKNOWN', departmentId: null }, new Map()), 'Chưa có lịch sử / cắt mốc chuyển')
assert.equal(rowLabel({ group: 'UNASSIGNED', departmentId: null }, new Map()), 'Chưa gán phòng ban')
assert.equal(rowLabel({ group: 'DEPARTMENT', departmentId: 'abcdef12-0000' }, new Map([['abcdef12-0000', 'Kế toán']])), 'Kế toán')
assert.equal(rowLabel({ group: 'DEPARTMENT', departmentId: 'abcdef12-0000' }, new Map()), 'Phòng ban abcdef12')
assert.equal(badRatioText(null), 'Chưa đủ timing')
assert.equal(badRatioText(0.2), '20.0%')
assert.equal(reportHidden({ status: 'SUPPRESSED' }) && reportHidden({ status: 'OVERLAPPING_WINDOWS' }), true)
assert.equal(reportHidden({ status: 'OK' }) || reportHidden({ status: 'NO_DATA' }), false)
assert.match(hiddenMessage({ status: 'SUPPRESSED', minimumGroupSize: 5 }), /dưới 5 người/)
assert.equal(suppressedHealthMessage(3), 'Nhóm dưới 3 người đủ dữ liệu, ẩn để bảo vệ riêng tư.')
console.log('PASS tuần báo cáo phòng ban theo giờ Việt Nam và nhãn dòng báo cáo')


const midnight = Date.parse('2026-11-25T17:00:00Z')
assert.equal(msUntilNextVnDay(new Date(midnight - 1)), 1)
assert.notEqual(vnToday(new Date(midnight - 1)).from, vnToday(new Date(midnight)).from)
assert.ok(vnToday(new Date(midnight)).from < vnToday(new Date(midnight)).to)
assert.equal(vnToday(new Date(midnight + 1)).to, new Date(midnight + 1).toISOString())
console.log('PASS khoảng Hôm nay trước, đúng và sau 00:00 giờ Việt Nam')

let rotations = 0
let refreshOffline = false
let timeline = Array.from({ length: 22 }, (_, i) => ({ ...alert, sessionId: String(i) }))
const requestedWindows = []
let liveToken = 'refresh-0'
const logoutBodies = []
const server = createServer(async (req, res) => {
  const parts = []
  for await (const part of req) parts.push(part)
  const body = JSON.parse(Buffer.concat(parts).toString() || '{}')
  function send(status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
  }
  if (req.url === '/api/v1/auth/refresh' && body.refreshToken === liveToken) {
    if (refreshOffline) {
      req.socket.destroy()
      return
    }
    rotations++
    liveToken = 'refresh-' + rotations
    send(200, { accessToken: 'access-' + rotations, refreshToken: liveToken, expiresIn: 900 })
  } else if (req.url === '/api/v1/auth/logout') {
    logoutBodies.push(body.refreshToken)
    if (req.headers.authorization !== 'Bearer access-' + rotations || rotations === 0) {
      send(401, { code: 'AUTH_TOKEN_EXPIRED' })
      return
    }
    if (body.refreshToken === liveToken) liveToken = null
    res.writeHead(204).end()
  } else if (req.url.startsWith('/api/v1/alerts/me?')) {
    const params = new URL(req.url, 'http://localhost').searchParams
    const page = Number(params.get('page'))
    const size = Number(params.get('size'))
    requestedWindows.push([params.get('from'), params.get('to')])
    send(200, { items: timeline.slice(page * size, (page + 1) * size), page, size, total: timeline.length })
  } else {
    send(401, { code: 'AUTH_INVALID_REFRESH_TOKEN' })
  }
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:' + server.address().port

const secureStoreStub = 'data:text/javascript,' + encodeURIComponent(
  'const entries = new Map(); export const setItemAsync = async (k,v) => entries.set(k,v);'
  + 'export const deleteItemAsync = async (k) => entries.delete(k); export const getItemAsync = async (k) => entries.get(k) ?? null;',
)
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'expo-crypto') return next('node:crypto', context)
    if (specifier === 'expo-secure-store') return { url: secureStoreStub, shortCircuit: true }
    if (specifier.startsWith('@/')) {
      return next(new URL('../src/' + specifier.slice(2) + '.ts', import.meta.url).href, context)
    }
    if (specifier.startsWith('.') && !specifier.endsWith('.ts') && context.parentURL?.startsWith(new URL('../src/', import.meta.url).href)) {
      return next(specifier + '.ts', context)
    }
    return next(specifier, context)
  },
})

try {
  const { refreshAccessToken, revokeCurrentSession } = await import('../src/api/client.ts')
  const { tokenStore } = await import('../src/api/tokenStore.ts')
  await tokenStore.setTokens({ accessToken: 'expired-token', refreshToken: liveToken, expiresIn: 900 })
  await revokeCurrentSession()
  assert.deepEqual(logoutBodies, ['refresh-0', 'refresh-1'])
  assert.equal(rotations, 1)
  assert.equal(liveToken, null)
  await tokenStore.load()
  assert.equal(tokenStore.getRefreshToken(), null)
  console.log('PASS logout với access token hết hạn thu hồi đúng refresh token mới')

  liveToken = 'second-session'
  logoutBodies.length = 0
  await tokenStore.setTokens({ accessToken: 'access-1', refreshToken: liveToken, expiresIn: 900 })
  const rotation = refreshAccessToken()
  const signOut = revokeCurrentSession()
  await assert.rejects(refreshAccessToken(), { code: 'ERR_CANCELED' })
  await Promise.all([rotation, signOut])
  assert.equal(rotations, 2)
  assert.deepEqual(logoutBodies, ['refresh-2'])
  assert.equal(liveToken, null)
  assert.equal(tokenStore.getRefreshToken(), null)
  console.log('PASS logout chờ lượt xoay token đang chạy và chặn lượt xoay mới')

  const { connectivity } = await import('../src/lib/connectivity.ts')
  liveToken = 'saved-session'
  await tokenStore.setTokens({ accessToken: '', refreshToken: liveToken, expiresIn: 900 })
  refreshOffline = true
  await assert.rejects(refreshAccessToken())
  assert.equal(connectivity.isOffline(), true)
  assert.equal(tokenStore.getRefreshToken(), 'saved-session')
  refreshOffline = false
  assert.equal(await refreshAccessToken(), 'access-3')
  assert.equal(connectivity.isOffline(), false)
  console.log('PASS lỗi mạng giữ refresh token và phục hồi phiên khi gọi lại thành công')

  const { HistoryChanged, historyQueryOptions } = await import('../src/api/alerts.ts')
  const cache = new QueryClient()
  const options = historyQueryOptions(['alerts', 'test'], '/alerts/me', 7)
  const history = new InfiniteQueryObserver(cache, options)
  const unsubscribe = history.subscribe(() => {})
  try {
    await history.refetch()
    timeline = [{ ...alert, sessionId: 'backfilled' }, ...timeline]
    const shifted = await history.fetchNextPage()
    assert.ok(shifted.error instanceof HistoryChanged)
    assert.deepEqual(requestedWindows[0], requestedWindows[1])
    await cache.resetQueries({ queryKey: options.queryKey, exact: true })
    const reset = await history.fetchNextPage()
    const rows = uniqueHistoryRows(reset.data.pages)
    assert.equal(rows[0].sessionId, 'backfilled')
    assert.equal(rows.length, 23)
    console.log('PASS phát hiện gửi bù giữa trang, đọc lại đủ 23 dòng với trang đầu mới')
  } finally {
    unsubscribe()
    cache.clear()
  }

} finally {
  hooks.deregister()
  server.close()
}
