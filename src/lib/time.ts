// Chép từ GIT_frontend/src/lib/time.ts (commit 9d5677d), giữ đồng bộ khi web đổi
// Backend nhận from/to dạng ISO-8601 có múi giờ. Gửi dạng UTC (…Z) để không phải lo mã hóa dấu "+".
// "Ngày" và heatmap phía backend tính theo giờ Việt Nam.

export const VN_TZ = 'Asia/Ho_Chi_Minh'

export function lastDays(days: number, now = new Date()) {
  const to = new Date(now)
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: VN_TZ,
  dateStyle: 'short',
  timeStyle: 'short',
})

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? dateTimeFmt.format(new Date(iso)) : '—'

/** 80 -> "1 phút 20 giây", 17 -> "17 giây", 7500 -> "2 giờ 5 phút". Không có số thì "—". */
export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`
  if (m > 0) return s > 0 ? `${m} phút ${s} giây` : `${m} phút`
  return `${s} giây`
}

const DAY = 24 * 60 * 60 * 1000
const VN_OFFSET = 7 * 60 * 60 * 1000 // Việt Nam không có giờ mùa hè

/** Mốc 00:00 giờ Việt Nam (dạng UTC ISO) của mọi ngày từ `days` ngày trước tới hôm nay. */
export function vnDayStarts(days: number, now = new Date()) {
  const today = Math.floor((now.getTime() + VN_OFFSET) / DAY) * DAY - VN_OFFSET
  return Array.from({ length: days + 1 }, (_, i) => new Date(today - (days - i) * DAY).toISOString())
}

/** Khoảng "hôm nay": từ 00:00 giờ Việt Nam đến bây giờ. */
export function vnToday(now = new Date()) {
  return { from: vnDayStarts(0, now)[0], to: now.toISOString() }
}

/** 45 -> "45 phút", 150 -> "2,5 giờ". Dưới 90 phút hiện phút để số nhỏ không thành "0 giờ". */
export function formatMinutes(minutes: number) {
  if (minutes < 90) return `${Math.round(minutes)} phút`
  return `${(minutes / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`
}
