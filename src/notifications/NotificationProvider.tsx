// Thông báo CỤC BỘ khi trạng thái của chính mình chuyển sang BAD (Socket.IO `status` -> expo-notifications).
// Chạy được trong Expo Go. Chỉ nhận khi app đang mở hoặc vừa chuyển sang nền (iOS/Android tạm dừng WebSocket sau ít
// phút ở nền); app tắt hẳn thì KHÔNG nhận. Push từ server cho trường hợp đó nằm ở bước sau (cần bản build riêng).
import * as Notifications from 'expo-notifications'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Linking, Platform } from 'react-native'
import { useAuth } from '@/auth/context'
import { alertLabel } from '@/lib/labels'
import { useRealtimeEvent } from '@/realtime/hooks'
import type { StatusEvent } from '@/realtime/socket'
import { loadPrefs, saveAsked, saveEnabled } from './prefs'
import { evaluateStatus, newNotifyState } from './rules'

const CHANNEL_ID = 'posture-alerts'

/** "Bạn đang <nhãn cảnh báo>"; hai loại nhắc việc (nghỉ mắt, ngồi lâu) đọc tự nhiên hơn nếu nói thẳng việc cần làm. */
function notificationBody(type: string) {
  if (type === 'EYE_BREAK') return 'Đã đến lúc nghỉ mắt. Hãy nhìn xa vài giây.'
  if (type === 'UNKNOWN') return 'Hãy chỉnh lại tư thế.'
  return `Bạn đang ${alertLabel(type).toLowerCase()}. Hãy chỉnh lại tư thế.`
}

// Cho phép hiện thông báo cả khi app đang mở. (Android: shouldPlaySound=false sẽ làm banner không hiện.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

async function ensureChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Cảnh báo tư thế',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  })
}

export type Permission = 'granted' | 'undetermined' | 'blocked'

async function readPermission(): Promise<Permission> {
  try {
    const p = await Notifications.getPermissionsAsync()
    if (p.granted) return 'granted'
    return p.canAskAgain ? 'undetermined' : 'blocked'
  } catch {
    return 'blocked'
  }
}

interface NotificationContextValue {
  /** Công tắc "Thông báo khi ngồi sai" (tùy chọn của máy này). */
  enabled: boolean
  permission: Permission
  ready: boolean
  /** Bật/tắt công tắc; bật thì hỏi quyền (có giải thích) nếu cần. Trả về công tắc sau cùng. */
  setEnabled: (on: boolean) => Promise<boolean>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotificationSettings(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotificationSettings phải nằm trong NotificationProvider')
  return ctx
}

const EXPLAIN_TITLE = 'Bật thông báo khi ngồi sai?'
const EXPLAIN_BODY =
  'KLTN Tư thế sẽ báo ngay khi bạn bắt đầu ngồi sai. Bạn chỉ nhận được khi ứng dụng đang mở hoặc vừa chuyển sang nền; ' +
  'tắt hẳn ứng dụng thì không nhận được. Bạn có thể tắt trong Cài đặt bất cứ lúc nào.'

/** Hộp thoại giải thích trước khi hệ điều hành hỏi quyền. Trả true nếu người dùng chọn "Cho phép". */
const explain = () =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      EXPLAIN_TITLE,
      EXPLAIN_BODY,
      [
        { text: 'Để sau', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Cho phép', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [enabled, setEnabledState] = useState(false)
  const [permission, setPermission] = useState<Permission>('undetermined')
  const [ready, setReady] = useState(false)
  const state = useRef(newNotifyState())
  const mine = useRef(user?.id)
  mine.current = user?.id

  const requestPermission = useCallback(async (): Promise<boolean> => {
    await ensureChannel()
    const current = await readPermission()
    if (current === 'granted') {
      setPermission('granted')
      return true
    }
    if (current === 'blocked') {
      setPermission('blocked')
      Alert.alert(
        'Thông báo đang bị tắt',
        'Hãy bật thông báo cho KLTN Tư thế trong Cài đặt của điện thoại.',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => void Linking.openSettings() },
        ],
      )
      return false
    }
    if (!(await explain())) return false
    try {
      const res = await Notifications.requestPermissionsAsync()
      setPermission(res.granted ? 'granted' : res.canAskAgain ? 'undetermined' : 'blocked')
      return res.granted
    } catch {
      setPermission('blocked')
      return false
    }
  }, [])

  // Lần đầu vào app: hỏi (có giải thích) một lần. Từ chối/để sau thì công tắc tắt; bật lại ở Cài đặt.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const prefs = await loadPrefs()
      if (cancelled) return
      const perm = await readPermission()
      setPermission(perm)
      if (prefs.asked) {
        setEnabledState(prefs.enabled && perm === 'granted')
        setReady(true)
        return
      }
      await saveAsked()
      const ok = await requestPermission()
      if (cancelled) return
      await saveEnabled(ok)
      setEnabledState(ok)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [requestPermission])

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (!on) {
        setEnabledState(false)
        await saveEnabled(false)
        return false
      }
      const ok = await requestPermission()
      setEnabledState(ok)
      await saveEnabled(ok)
      return ok
    },
    [requestPermission],
  )

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useRealtimeEvent<StatusEvent>('status', (e) => {
    if (e.userId !== mine.current) return
    // Luôn chạy luật để `lastState` đúng kể cả khi công tắc tắt (bật lên không báo lại trạng thái cũ).
    const type = evaluateStatus(state.current, e, Date.now())
    if (!type || !enabledRef.current) return
    void Notifications.scheduleNotificationAsync({
      content: {
        title: 'Bạn đang ngồi sai',
        body: notificationBody(type),
        data: { alertType: type },
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    }).catch(() => {
      /* không hiện được thông báo (quyền bị thu hồi): bỏ qua, màn Hôm nay vẫn có trạng thái */
    })
  })

  const value = useMemo(() => ({ enabled, permission, ready, setEnabled }), [enabled, permission, ready, setEnabled])
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
