// Kiểm luật thông báo cục bộ (src/notifications/rules.ts), logic thuần nên chạy được bằng Node:
//   node --experimental-strip-types dev/check-notify-rules.mjs
import assert from 'node:assert/strict'
import { DEBOUNCE_MS, FRESH_MS, evaluateStatus, newNotifyState } from '../src/notifications/rules.ts'

const T0 = Date.parse('2026-11-11T08:00:00Z')
const ev = (state, alertType, atMs, deviceId = 'd1') => ({ userId: 'u', deviceId, state, alertType, ts: new Date(atMs).toISOString() })
let n = 0
const ok = (name, fn) => { fn(); n++; console.log('PASS ', name) }

ok('GOOD -> BAD báo một lần', () => {
  const st = newNotifyState()
  assert.equal(evaluateStatus(st, ev('GOOD', null, T0), T0), null)
  assert.equal(evaluateStatus(st, ev('BAD', 'NECK_TRUNK', T0 + 1000), T0 + 1000), 'NECK_TRUNK')
})
ok('BAD lặp lại (vẫn BAD) không báo thêm', () => {
  const st = newNotifyState()
  evaluateStatus(st, ev('BAD', 'NECK_TRUNK', T0), T0)
  assert.equal(evaluateStatus(st, ev('BAD', 'NECK_TRUNK', T0 + 5000), T0 + 5000), null)
})
ok('cùng loại trong 5 phút: không báo; sau 5 phút: báo', () => {
  const st = newNotifyState()
  evaluateStatus(st, ev('BAD', 'NECK_TRUNK', T0), T0)
  evaluateStatus(st, ev('GOOD', null, T0 + 10_000), T0 + 10_000)
  assert.equal(evaluateStatus(st, ev('BAD', 'NECK_TRUNK', T0 + 60_000), T0 + 60_000), null)
  evaluateStatus(st, ev('GOOD', null, T0 + 70_000), T0 + 70_000)
  const later = T0 + DEBOUNCE_MS + 1000
  assert.equal(evaluateStatus(st, ev('BAD', 'NECK_TRUNK', later), later), 'NECK_TRUNK')
})
ok('loại khác nhau báo riêng (debounce theo từng loại)', () => {
  const st = newNotifyState()
  evaluateStatus(st, ev('BAD', 'NECK_TRUNK', T0), T0)
  evaluateStatus(st, ev('GOOD', null, T0 + 5000), T0 + 5000)
  assert.equal(evaluateStatus(st, ev('BAD', 'SHOULDER_TILT', T0 + 10_000), T0 + 10_000), 'SHOULDER_TILT')
})
ok('gói cũ (snapshot lúc mới kết nối) không báo', () => {
  const st = newNotifyState()
  assert.equal(evaluateStatus(st, ev('BAD', 'NECK_TRUNK', T0 - FRESH_MS - 1000), T0), null)
})
ok('hai máy độc lập theo deviceId', () => {
  const st = newNotifyState()
  assert.equal(evaluateStatus(st, ev('BAD', 'TOO_CLOSE', T0, 'a'), T0), 'TOO_CLOSE')
  evaluateStatus(st, ev('GOOD', null, T0 + 1000, 'b'), T0 + 1000)
  assert.equal(evaluateStatus(st, ev('BAD', 'TOO_CLOSE', T0 + 2000, 'b'), T0 + 2000), null) // cùng loại, còn trong 5 phút
})
ok('alertType null vẫn báo (loại UNKNOWN)', () => {
  const st = newNotifyState()
  assert.equal(evaluateStatus(st, ev('BAD', null, T0), T0), 'UNKNOWN')
})
console.log(`\n${n} đạt`)
