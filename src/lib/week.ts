// Tuần báo cáo phòng ban: bắt đầu thứ Hai 00:00 giờ Việt Nam (UTC+7, không có giờ mùa hè), dạng "YYYY-MM-DD".
// Tính bằng số học UTC, không dùng Intl nên giống nhau trên mọi máy.

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY
const VN_OFFSET = 7 * 60 * 60 * 1000

/** Backend chỉ nhận tuần đã kết thúc trong 13 tuần gần nhất. */
export const MAX_WEEKS_BACK = 13

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Thứ Hai đầu tuần (giờ Việt Nam) của tuần chứa `now`. */
export function vnWeekStart(now = new Date()): string {
  const vnDay = Math.floor((now.getTime() + VN_OFFSET) / DAY) * DAY // 00:00 theo lịch Việt Nam, biểu diễn như UTC
  const sinceMonday = (new Date(vnDay).getUTCDay() + 6) % 7
  return iso(vnDay - sinceMonday * DAY)
}

export const shiftWeek = (week: string, count: number) => iso(Date.parse(`${week}T00:00:00Z`) + count * WEEK)

/** Mặc định: tuần hoàn tất gần nhất (tuần trước). */
export const defaultReportWeek = (now = new Date()) => shiftWeek(vnWeekStart(now), -1)

/** Tuần cũ nhất backend còn nhận. */
export const oldestReportWeek = (now = new Date()) => shiftWeek(vnWeekStart(now), -MAX_WEEKS_BACK)

export const canGoEarlier = (week: string, now = new Date()) => week > oldestReportWeek(now)
export const canGoLater = (week: string, now = new Date()) => week < defaultReportWeek(now)

/** "2026-11-16" -> "16/11 – 22/11/2026" */
export function formatWeekRange(week: string): string {
  const start = new Date(`${week}T00:00:00Z`)
  const end = new Date(start.getTime() + 6 * DAY)
  const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return `${dm(start)} – ${dm(end)}/${end.getUTCFullYear()}`
}
