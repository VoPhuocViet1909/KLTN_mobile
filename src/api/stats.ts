// Dựa trên GIT_frontend/src/lib/api/stats.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
import { useQuery } from '@tanstack/react-query'
import { vnToday } from '@/lib/time'
import { request } from './client'

// analytics-service – team-sync mục 4.6

export interface Summary {
  /** trung bình có trọng số theo thời gian có mặt; null khi không có dữ liệu */
  meanScore: number | null
  badMinutes: number
  presenceMinutes: number
  /** số lần cảnh báo theo loại, ví dụ {NECK_TRUNK: 3} */
  alerts: Record<string, number>
}

export const sumAlerts = (alerts: Record<string, number>) =>
  Object.values(alerts).reduce((a, b) => a + b, 0)

export const fetchSummary = (range: { from: string; to: string }) =>
  request<Summary>({ url: '/stats/me/summary', params: range })

/** Số liệu hôm nay (từ 00:00 giờ Việt Nam). Mỗi lần tải lại tính lại `to` = bây giờ; khóa cache đổi khi sang ngày mới. */
export function useTodaySummary() {
  return useQuery({
    queryKey: ['stats', 'me', 'summary', 'today', vnToday().from],
    queryFn: () => fetchSummary(vnToday()),
  })
}
