// Chép từ GIT_frontend/src/lib/api/alerts.ts (commit 9d5677d), giữ đồng bộ khi web đổi. Thêm hook cuộn vô hạn cho mobile.
import { useInfiniteQuery } from '@tanstack/react-query'
import { lastDays } from '@/lib/time'
import { request } from './client'

// alert-service – team-sync mục 4.5

export interface Paged<T> {
  items: T[]
  /** bắt đầu từ 0 */
  page: number
  size: number
  total: number
}

export interface AlertItem {
  userId: string
  deviceId: string
  sessionId: string
  alertType: string
  /** LOW | MEDIUM | HIGH; mã lạ hiện nguyên */
  severity: string
  startedAt: string
  endedAt: string | null
  durationSec: number | null
  /** CORRECTED | SESSION_END | SESSION_TIMEOUT; mã lạ hiện nguyên */
  endReason: string | null
  repeatCount: number
  /** chưa kết thúc */
  open: boolean
}

export interface SessionItem {
  deviceId: string
  sessionId: string
  startedAt: string | null
  endedAt: string | null
  /** SESSION_END | TIMEOUT; mã lạ hiện nguyên */
  endReason: string | null
  lastSeenAt: string | null
  open: boolean
  alertCount: number
}

export const HISTORY_PAGE_SIZE = 20

/** Backend giới hạn khoảng thời gian tối đa 92 ngày. */
export const MAX_HISTORY_DAYS = 92

// `from`/`to` tính trong queryFn (như stats.ts) để khóa truy vấn chỉ phụ thuộc `days`, không đổi theo từng lần render.

const nextPage = <T,>(last: Paged<T>) => ((last.page + 1) * last.size < last.total ? last.page + 1 : undefined)

/** Cuộn vô hạn: mỗi trang HISTORY_PAGE_SIZE mục; `lastDays` tính lại trong queryFn nên khóa chỉ phụ thuộc `days`/loại. */
export function useMyAlerts(days: number, alertType: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['alerts', 'me', days, alertType ?? null],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      request<Paged<AlertItem>>({
        url: '/alerts/me',
        params: { ...lastDays(days), alertType, page: pageParam, size: HISTORY_PAGE_SIZE },
      }),
    getNextPageParam: nextPage,
  })
}

export function useMySessions(days: number) {
  return useInfiniteQuery({
    queryKey: ['alerts', 'me', 'sessions', days],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      request<Paged<SessionItem>>({
        url: '/alerts/me/sessions',
        params: { ...lastDays(days), page: pageParam, size: HISTORY_PAGE_SIZE },
      }),
    getNextPageParam: nextPage,
  })
}
