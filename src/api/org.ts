// Dựa trên GIT_frontend/src/lib/api/org.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
// ORG_ADMIN có orgId – team-sync mục 4.5 và 4.6. `from`/`to` tính trong queryFn để khóa truy vấn chỉ phụ thuộc `days`.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { lastDays } from '@/lib/time'
import { HISTORY_PAGE_SIZE, type AlertItem, type Paged } from './alerts'
import { request } from './client'
import type { Bucket, Summary } from './stats'

export function useOrgSummary(days: number, enabled = true) {
  return useQuery({
    queryKey: ['stats', 'org', 'summary', days],
    queryFn: () => request<Summary>({ url: '/stats/org/summary', params: lastDays(days) }),
    enabled,
  })
}

/** Giống `/stats/me/timeseries`, gộp cả tổ chức. */
export function useOrgTimeseries(days: number, bucket: 'hour' | 'day' = 'day', enabled = true) {
  return useQuery({
    queryKey: ['stats', 'org', 'timeseries', days, bucket],
    queryFn: () => request<Bucket[]>({ url: '/stats/org/timeseries', params: { ...lastDays(days), bucket } }),
    enabled,
  })
}

/** Một nhân viên có số liệu trong khoảng (team-sync 4.6). Tên lấy từ GET /users. */
export interface OrgMember extends Summary {
  userId: string
}

/** Mỗi nhân viên một dòng, ngồi sai nhiều nhất trước. */
export function useOrgMembers(days: number, enabled = true) {
  return useQuery({
    queryKey: ['stats', 'org', 'members', days],
    queryFn: () => request<OrgMember[]>({ url: '/stats/org/members', params: lastDays(days) }),
    enabled,
  })
}

/** Cảnh báo của một nhân viên (`/alerts/org?userId=`), mới nhất trước, cuộn vô hạn. */
export function useOrgMemberAlerts(userId: string, days: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['alerts', 'org', userId, days],
    initialPageParam: 0,
    enabled,
    queryFn: ({ pageParam }) =>
      request<Paged<AlertItem>>({
        url: '/alerts/org',
        params: { ...lastDays(days), userId, page: pageParam, size: HISTORY_PAGE_SIZE },
      }),
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.total ? last.page + 1 : undefined),
  })
}
