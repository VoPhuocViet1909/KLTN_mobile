// Dựa trên GIT_frontend/src/lib/api/departmentHistory.ts (commit a500d43), giữ đồng bộ khi web đổi.
// GET /stats/org/departments/report – STEP13-DEPARTMENT-HISTORY.md: tuần thứ Hai 00:00 giờ Việt Nam, đã kết thúc,
// trong 13 tuần gần nhất. Quá phạm vi → 400 VALIDATION_FAILED; lịch sử phòng ban lỗi → 503 DEPARTMENT_HISTORY_UNAVAILABLE.
import { useQuery } from '@tanstack/react-query'
import { request } from './client'

export type ReportGroup = 'DEPARTMENT' | 'UNASSIGNED' | 'UNKNOWN'
export type ReportRowStatus = 'OK' | 'NO_DATA' | 'NO_TIMING' | 'SUPPRESSED' | 'OVERLAPPING_WINDOWS'

export interface DepartmentReportRow {
  group: ReportGroup
  departmentId: string | null
  status: ReportRowStatus
  contributors: number | null
  presenceSec: number | null
  knownSec: number | null
  badSec: number | null
  /** 0..1; null khi chưa có timing thực */
  badRatio: number | null
  legacyPresenceSec: number | null
  alertCount: number | null
}

export interface DepartmentReport {
  /** Thứ Hai đầu tuần, YYYY-MM-DD theo giờ Việt Nam */
  week: string
  from: string
  to: string
  dataAsOf: string
  minimumGroupSize: number
  status: 'OK' | 'NO_DATA' | 'SUPPRESSED' | 'OVERLAPPING_WINDOWS'
  rows: DepartmentReportRow[]
}

export const DEPARTMENT_REPORT_QUERY_KEY = ['stats', 'org', 'department-report'] as const

export function useDepartmentReport(week: string, enabled = true) {
  return useQuery({
    queryKey: [...DEPARTMENT_REPORT_QUERY_KEY, week],
    queryFn: () => request<DepartmentReport>({ url: '/stats/org/departments/report', params: { week } }),
    enabled,
    retry: false,
  })
}
