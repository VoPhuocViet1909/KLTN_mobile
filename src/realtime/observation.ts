// Phần trạng thái hiển thị của device-state v1, theo hợp đồng dùng chung với Dashboard.
const REASONS = {
  GOOD: 'NONE',
  BAD: 'NONE',
  AWAY: 'NONE',
  OFFLINE: 'SESSION_STOPPED',
  CALIBRATING: 'CALIBRATING',
  UNKNOWN: 'INSUFFICIENT_DATA',
  CAMERA_LOST: 'CAMERA_READ_FAILED',
} as const

export type ObservationState = keyof typeof REASONS

export interface DeviceObservation {
  version: 1
  userId: string
  deviceId: string
  sessionId: string
  sequence: number
  state: ObservationState
  reason: string
  observedAt: string
  receivedAt: string
  expiresAt: string
}

export function validObservation(value: unknown): value is DeviceObservation {
  if (!value || typeof value !== 'object') return false
  const event = value as DeviceObservation
  const observed = Date.parse(event.observedAt)
  const received = Date.parse(event.receivedAt)
  const expires = Date.parse(event.expiresAt)
  return event.version === 1 && typeof event.userId === 'string'
    && typeof event.deviceId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(event.deviceId)
    && typeof event.sessionId === 'string'
    && typeof event.state === 'string' && Object.hasOwn(REASONS, event.state)
    && event.reason === REASONS[event.state]
    && Number.isSafeInteger(event.sequence) && event.sequence > 0
    && expires > received && expires - received <= 15_000 && Math.abs(received - observed) <= 10_000
}

export function newerObservation(next: DeviceObservation, previous?: DeviceObservation) {
  return !previous || (next.sessionId === previous.sessionId
    ? next.sequence > previous.sequence
    : Date.parse(next.observedAt) >= Date.parse(previous.observedAt))
}

export function currentObservations(events: readonly DeviceObservation[], userId: string | undefined, now: number) {
  return events
    .filter((event) => event.userId === userId && Date.parse(event.expiresAt) > now)
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
}
