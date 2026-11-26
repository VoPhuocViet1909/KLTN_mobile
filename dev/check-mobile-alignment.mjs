// Hồi quy client mobile, chạy với Node 24. Gateway HTTP và SecureStore được mô phỏng tại chỗ.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { currentObservations, newerObservation, validObservation } from '../src/realtime/observation.ts'

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
console.log('PASS device-state v1, thứ tự, chính chủ và hết hạn')

let rotations = 0
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
} finally {
  hooks.deregister()
  server.close()
}
