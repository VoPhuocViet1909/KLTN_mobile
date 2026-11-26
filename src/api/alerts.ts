// Chép từ GIT_frontend/src/lib/api/alerts.ts (commit 9d5677d), giữ đồng bộ khi web đổi. Thêm hook cuộn vô hạn cho mobile.
import { infiniteQueryOptions, useInfiniteQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'
import { historyRowKey } from '@/lib/historyRows'
import { ApiError } from '@/lib/errors'
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

type HistoryWindow = ReturnType<typeof lastDays>
type PageRequest = { page: number; window: HistoryWindow; total: number; previousKeys: string[] }
type HistoryPage<T> = Paged<T> & { window: HistoryWindow }

export class HistoryChanged extends Error {}

/** Giữ cùng cửa sổ cho các trang. Nếu Desktop gửi bù và làm lệch offset, đọc lại từ trang đầu. */
export function historyQueryOptions<T extends AlertItem | SessionItem>(
  queryKey: QueryKey,
  url: string,
  days: number,
  filters: Record<string, string | undefined> = {},
  enabled = true,
) {
  return infiniteQueryOptions({
    queryKey,
    enabled,
    initialPageParam: null as PageRequest | null,
    queryFn: async ({ pageParam, signal }): Promise<HistoryPage<T>> => {
      const window = pageParam?.window ?? lastDays(days)
      const page = await request<Paged<T>>({
        url, signal, params: { ...window, ...filters, page: pageParam?.page ?? 0, size: HISTORY_PAGE_SIZE },
      })
      if (pageParam && (
        page.total !== pageParam.total || page.items.some((item) => pageParam.previousKeys.includes(historyRowKey(item)))
      )) {
        throw new HistoryChanged('Lịch sử vừa thay đổi. Đang tải lại từ đầu.')
      }
      return { ...page, window }
    },
    getNextPageParam: (last): PageRequest | undefined => {
      const next = last.page + 1
      return next * last.size < last.total
        ? { page: next, window: last.window, total: last.total, previousKeys: last.items.map(historyRowKey) }
        : undefined
    },
    retry: (count, error) => !(error instanceof HistoryChanged || error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
  })
}

export function useHistoryPages<T extends AlertItem | SessionItem>(
  queryKey: QueryKey, url: string, days: number, filters?: Record<string, string | undefined>, enabled?: boolean,
) {
  const qc = useQueryClient()
  const query = useInfiniteQuery(historyQueryOptions<T>(queryKey, url, days, filters, enabled))

  useEffect(() => {
    if (query.error instanceof HistoryChanged) {
      void qc.resetQueries({ queryKey, exact: true })
    }
  }, [qc, query.error, queryKey])

  return {
    ...query,
    loadMore: () => query.fetchNextPage({ cancelRefetch: false }),
    refresh: () => qc.resetQueries({ queryKey, exact: true }),
  }
}

export function useMyAlerts(days: number, alertType: string | undefined) {
  return useHistoryPages<AlertItem>(['alerts', 'me', days, alertType ?? null], '/alerts/me', days, { alertType })
}

export function useMySessions(days: number) {
  return useHistoryPages<SessionItem>(['alerts', 'me', 'sessions', days], '/alerts/me/sessions', days)
}
