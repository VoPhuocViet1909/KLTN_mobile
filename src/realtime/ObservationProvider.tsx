import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isOrgAdmin, useAuth } from '@/auth/context'
import { useRealtimeConnected, useRealtimeEvent } from './hooks'
import { currentObservations, newerObservation, validObservation, type DeviceObservation } from './observation'
import { onConnectionChange } from './socket'

type ObservationContextValue = {
  connected: boolean
  devices: DeviceObservation[]
  ownersSeen: ReadonlySet<string>
}

const ObservationContext = createContext<ObservationContextValue | null>(null)

export function ObservationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const includeOrganization = isOrgAdmin(user)
  const [events, setEvents] = useState(() => new Map<string, DeviceObservation>())
  const [now, setNow] = useState(() => Date.now())
  const connected = useRealtimeConnected()

  useEffect(() => onConnectionChange((online) => {
    if (!online) setEvents(new Map())
  }), [])

  useRealtimeEvent<unknown>('device-state', (event) => {
    if (!userId || !validObservation(event) || (!includeOrganization && event.userId !== userId)) return
    setNow(Date.now())
    setEvents((previous) => {
      const key = `${event.userId}:${event.deviceId}`
      if (!newerObservation(event, previous.get(key))) return previous
      const next = new Map(previous)
      next.set(key, event)
      return next
    })
  })

  const records = [...events.values()]
  const devices = connected ? currentObservations(records, userId, now, includeOrganization) : []
  const nextExpiry = Math.min(...devices.map((event) => Date.parse(event.expiresAt)))
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()))
    return () => clearTimeout(timer)
  }, [nextExpiry])

  const ownersSeen = new Set(records.map((event) => event.userId))
  return <ObservationContext.Provider value={{ connected, devices, ownersSeen }}>{children}</ObservationContext.Provider>
}

export function useObservations() {
  const value = useContext(ObservationContext)
  if (!value) throw new Error('useObservations phải nằm trong ObservationProvider')
  return value
}

export function useMyObservations(userId: string | undefined) {
  const { connected, devices, ownersSeen } = useObservations()
  return {
    connected,
    devices: devices.filter((device) => device.userId === userId),
    hasObservation: userId !== undefined && ownersSeen.has(userId),
  }
}
