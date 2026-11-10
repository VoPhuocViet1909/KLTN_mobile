// Tùy chọn thông báo của MÁY NÀY (không gửi lên config-service). Lưu bằng expo-secure-store.
import * as SecureStore from 'expo-secure-store'

const ENABLED_KEY = 'kltn.notify.enabled'
const ASKED_KEY = 'kltn.notify.asked'

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function write(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    /* không ghi được: tùy chọn chỉ có hiệu lực tới khi tắt app */
  }
}

export interface NotifyPrefs {
  /** Công tắc "Thông báo khi ngồi sai". */
  enabled: boolean
  /** Đã hỏi quyền lần đầu (có giải thích) hay chưa. */
  asked: boolean
}

export async function loadPrefs(): Promise<NotifyPrefs> {
  const [enabled, asked] = await Promise.all([read(ENABLED_KEY), read(ASKED_KEY)])
  return { enabled: enabled === '1', asked: asked === '1' }
}

export const saveEnabled = (v: boolean) => write(ENABLED_KEY, v ? '1' : '0')
export const saveAsked = () => write(ASKED_KEY, '1')
