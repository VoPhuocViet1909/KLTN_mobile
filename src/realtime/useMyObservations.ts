import { useEffect, useState } from 'react'
import { useRealtimeConnected, useRealtimeEvent } from './hooks'
import { currentObservations, newerObservation, validObservation, type DeviceObservation } from './observation'
import { onConnectionChange } from './socket'

export function useMyObservations(userId: string | undefined) {
  const [events, setEvents] = useState(() => new Map<string, DeviceObservation>())
  const [now, setNow] = useState(() => Date.now())
  const connected = useRealtimeConnected()

  useEffect(() => onConnectionChange((online) => {
    if (!online) setEvents(new Map())
  }), [])

  useRealtimeEvent<unknown>('device-state', (event) => {
    if (!userId || !validObservation(event) || event.userId !== userId) return
    setNow(Date.now())
    setEvents((previous) => {
      const old = previous.get(event.deviceId)
      if (!newerObservation(event, old?.userId === userId ? old : undefined)) return previous
      const next = new Map(previous)
      next.set(event.deviceId, event)
      return next
    })
  })

  const devices = connected ? currentObservations([...events.values()], userId, now) : []
  const nextExpiry = Math.min(...devices.map((event) => Date.parse(event.expiresAt)))
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()))
    return () => clearTimeout(timer)
  }, [nextExpiry])

  return { connected, devices, hasObservation: [...events.values()].some((event) => event.userId === userId) }
}
