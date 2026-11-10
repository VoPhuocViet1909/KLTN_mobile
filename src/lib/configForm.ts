// Chép từ GIT_frontend/src/lib/configForm.ts (commit 9d5677d), giữ đồng bộ khi web đổi. Chỉ đổi đường dẫn import.
import type { ConfigValues } from '@/api/config'
import { CONFIG_FIELDS, DISTANCE_DEFAULTS, FIELD_BY_KEY, PRESERVED_KEYS, type ConfigField } from '@/lib/configFields'

/**
 * Trạng thái form: khóa CÓ mặt = "Tùy chỉnh" (sẽ gửi), khóa vắng = "Mặc định" (không gửi).
 * Ô số giữ nguyên chuỗi người dùng gõ; ô công tắc giữ boolean.
 */
export type Draft = Record<string, string | boolean | null>

/** null là tùy chỉnh theo mô hình, vẫn phải giữ khi tổ chức có ngưỡng số. */
export function draftFromServer(cfg: ConfigValues | undefined): Draft {
  const draft: Draft = {}
  for (const f of CONFIG_FIELDS) {
    const v = cfg?.[f.key]
    if (v === undefined) continue
    if (v === null) { draft[f.key] = null; continue }
    if (f.kind === 'boolean') draft[f.key] = typeof v === 'boolean' ? v : Boolean(f.default)
    else draft[f.key] = String(v)
  }
  return draft
}

/** Body PUT: đúng các khóa Tùy chỉnh, cộng khóa hiệu chỉnh riêng máy đang có (PUT thay toàn bộ, bỏ sót là mất). */
export function buildBody(
  draft: Draft,
  server: ConfigValues | undefined,
  preserveKeys: readonly string[] = PRESERVED_KEYS,
): ConfigValues {
  const body: ConfigValues = {}
  for (const key of preserveKeys) {
    const v = server?.[key]
    if (v !== undefined) body[key] = v
  }
  for (const [key, v] of Object.entries(draft)) {
    body[key] = v === null || typeof v === 'boolean' ? v : Number(v)
  }
  return body
}

/** Body cho "Xóa mọi tùy chỉnh": mọi thứ về mặc định, trừ hiệu chỉnh riêng máy. */
export const clearedBody = (server: ConfigValues | undefined, preserveKeys: readonly string[] = PRESERVED_KEYS) =>
  buildBody({}, server, preserveKeys)

const norm = (v: string | boolean | null | undefined) => {
  if (typeof v !== 'string') return v
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) ? n : v
}

/** Các khóa khác nhau giữa hai trạng thái (đổi chế độ hoặc đổi giá trị). */
export function changedKeys(a: Draft, b: Draft): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].filter((k) => norm(a[k]) !== norm(b[k]))
}

/** Khóa so sánh ổn định: thứ tự khóa của server có thể khác nhau giữa GET và PUT. */
export function stableKey(cfg: ConfigValues | undefined) {
  return JSON.stringify(Object.entries(cfg ?? {}).sort(([a], [b]) => a.localeCompare(b)))
}

/** Lỗi theo ô (chỉ ô Tùy chỉnh có lỗi riêng; lỗi cặp ngưỡng gắn vào ô đang Tùy chỉnh). */
export function validateDraft(draft: Draft, inherited: ConfigValues = {}): Record<string, string> {
  const errors: Record<string, string> = {}

  const num = (f: ConfigField): number | null => {
    const v = draft[f.key]
    if (typeof v !== 'string') return null
    if (v.trim() === '') {
      errors[f.key] = 'Nhập một số, hoặc chọn "Về mặc định".'
      return null
    }
    const n = Number(v)
    const unit = f.unit ? ` ${f.unit}` : ''
    if (!Number.isFinite(n)) errors[f.key] = 'Phải là một số.'
    else if (f.kind === 'integer' && !Number.isInteger(n)) errors[f.key] = 'Phải là số nguyên.'
    else if (f.min !== undefined && n < f.min) errors[f.key] = `Không nhỏ hơn ${f.min}${unit}.`
    else if (f.max !== undefined && n > f.max) errors[f.key] = `Không lớn hơn ${f.max}${unit}.`
    else return n
    return null
  }

  const values: Record<string, number | null> = {}
  for (const f of CONFIG_FIELDS) {
    if (f.kind !== 'boolean' && f.key in draft) values[f.key] = num(f)
  }

  // distance_off_cm >= distance_on_cm, tính cả mặc định 50/55 khi một bên để mặc định
  const onCustom = 'distance_on_cm' in draft
  const offCustom = 'distance_off_cm' in draft
  const on = onCustom ? values.distance_on_cm : Number(inherited.distance_on_cm ?? DISTANCE_DEFAULTS.on)
  const off = offCustom ? values.distance_off_cm : Number(inherited.distance_off_cm ?? DISTANCE_DEFAULTS.off)
  if (on !== null && on !== undefined && off !== null && off !== undefined && off < on) {
    const target = offCustom ? 'distance_off_cm' : 'distance_on_cm'
    if (!errors[target]) {
      errors[target] = offCustom
        ? `Phải lớn hơn hoặc bằng mức báo (${on} cm).`
        : `Không lớn hơn mức hết báo đang áp dụng (${off} cm). Hạ mức này, hoặc đặt mức hết báo cao hơn.`
    }
  }

  // shoulder_tilt_off <= shoulder_tilt_on khi cả hai có số (một bên để mặc định thì mô hình quyết định)
  const sOn = 'shoulder_tilt_on' in draft ? values.shoulder_tilt_on : inherited.shoulder_tilt_on
  const sOff = 'shoulder_tilt_off' in draft ? values.shoulder_tilt_off : inherited.shoulder_tilt_off
  if (typeof sOn === 'number' && typeof sOff === 'number' && sOff > sOn) {
    const target = 'shoulder_tilt_off' in draft ? 'shoulder_tilt_off' : 'shoulder_tilt_on'
    if (!errors[target]) errors[target] = `Mức hết báo (${sOff}°) không được lớn hơn mức báo (${sOn}°).`
  }

  return errors
}

export const isKnownField = (key: string) => key in FIELD_BY_KEY
