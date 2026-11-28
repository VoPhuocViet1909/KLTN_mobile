// Nhãn và chữ cho báo cáo phòng ban, theo web HistoricalDepartmentReport (a500d43) và STEP13-DEPARTMENT-HISTORY.md.
import type { DepartmentReport, DepartmentReportRow } from '@/api/departmentReport'

export const UNKNOWN_LABEL = 'Chưa có lịch sử / cắt mốc chuyển'
export const UNASSIGNED_LABEL = 'Chưa gán phòng ban'

/** Tên hiển thị của một dòng; thiếu tên trong danh mục thì giữ mã rút gọn, không đoán tên cũ. */
export function rowLabel(row: DepartmentReportRow, names: Map<string, string>): string {
  if (row.group === 'UNKNOWN') return UNKNOWN_LABEL
  if (row.group === 'UNASSIGNED') return UNASSIGNED_LABEL
  return (row.departmentId && names.get(row.departmentId)) || `Phòng ban ${row.departmentId?.slice(0, 8) ?? '—'}`
}

export const badRatioText = (ratio: number | null) => (ratio === null ? 'Chưa đủ timing' : `${(ratio * 100).toFixed(1)}%`)

/** Báo cáo bị ẩn số: nhóm nhỏ hoặc cửa sổ chồng nhau. Khi đó không được hiện số nào. */
export const reportHidden = (r: Pick<DepartmentReport, 'status'>) => r.status === 'SUPPRESSED' || r.status === 'OVERLAPPING_WINDOWS'

export function hiddenMessage(r: Pick<DepartmentReport, 'status' | 'minimumGroupSize'>): string {
  return r.status === 'SUPPRESSED'
    ? `Có nhóm dưới ${r.minimumGroupSize} người có dữ liệu. Toàn bộ số liệu của báo cáo tuần này được ẩn, kể cả tổng và nhóm chưa có lịch sử.`
    : 'Có các cửa sổ theo dõi của cùng người chồng thời gian. Chưa hiển thị số liệu để tránh cộng đôi nhiều thiết bị.'
}

/** Chỉ dòng phòng ban thật mới mở được nguy cơ sức khỏe của phòng đó. */
export const canOpenHealth = (r: DepartmentReportRow) => r.group === 'DEPARTMENT' && !!r.departmentId

export const suppressedHealthMessage = (minGroupSize: number) =>
  `Nhóm dưới ${minGroupSize} người đủ dữ liệu, ẩn để bảo vệ riêng tư.`
