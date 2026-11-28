import { toApiError } from '@/lib/errors'

/** Lỗi API nguy cơ sức khỏe tổ chức: 403 và 503 INSIGHT_DATA_UNAVAILABLE có chữ riêng. */
export function insightErrorMessage(err: unknown): string {
  const e = toApiError(err)
  if (e.status === 403) return 'Bạn không có quyền xem nguy cơ sức khỏe của tổ chức. Chỉ quản lý tổ chức mới xem được.'
  if (e.status === 503 && e.code === 'INSIGHT_DATA_UNAVAILABLE') {
    return 'Dữ liệu thống kê chưa sẵn sàng nên chưa tính được nguy cơ. Hãy thử lại sau ít phút.'
  }
  return `Chưa tải được nguy cơ sức khỏe: ${e.message}`
}
