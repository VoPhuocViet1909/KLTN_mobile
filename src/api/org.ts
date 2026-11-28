// Dựa trên GIT_frontend/src/lib/api/org.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
// ORG_ADMIN có orgId – team-sync mục 4.5 và 4.6. `from`/`to` tính trong queryFn để khóa truy vấn chỉ phụ thuộc `days`.
import { useQuery } from '@tanstack/react-query'
import { lastDays } from '@/lib/time'
import { useHistoryPages, type AlertItem } from './alerts'
import { request } from './client'
import type { Bucket, HeatmapCell, Summary } from './stats'

/** Heatmap thói quen cả tổ chức (team-sync 4.6): đúng 168 ô như `/stats/me/heatmap`, `weeks` 1–12. Chép từ web `useOrgHeatmap` (a500d43). */
export function useOrgHeatmap(weeks: number, enabled = true) {
  return useQuery({
    queryKey: ['stats', 'org', 'heatmap', weeks],
    queryFn: () => request<HeatmapCell[]>({ url: '/stats/org/heatmap', params: { weeks } }),
    enabled,
  })
}

export interface Department {
  id: string
  organizationId: string
  name: string
  active: boolean
}

/** Backend trả mảng thuần (không phân trang). Dùng để tra tên và chọn phòng ban. */
export function useDepartments(orgId: string, enabled = true) {
  return useQuery({
    queryKey: ['org', orgId, 'departments'],
    queryFn: () => request<Department[]>({ url: `/organizations/${encodeURIComponent(orgId)}/departments` }),
    enabled,
  })
}

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
  return useHistoryPages<AlertItem>(['alerts', 'org', userId, days], '/alerts/org', days, { userId }, enabled)
}
