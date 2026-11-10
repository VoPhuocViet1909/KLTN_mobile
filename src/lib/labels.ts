// Dựa trên GIT_frontend/src/lib/labels.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
// Icon dùng lucide-react-native (cùng bộ Lucide với web).
import { CircleCheck, CircleOff, Moon, TriangleAlert, type LucideIcon } from 'lucide-react-native'
import type { DeviceState } from '@/realtime/socket'
import { colors } from '@/theme/tokens'
import type { Role } from './types'

/** Tên hiển thị của loại cảnh báo (alertType từ App). Loại lạ thì hiện nguyên mã. */
export const ALERT_LABEL: Record<string, string> = {
  NECK_TRUNK: 'Cúi cổ, gù lưng',
  SHOULDER_TILT: 'Lệch vai',
  TOO_CLOSE: 'Ngồi quá gần màn hình',
  SIT_TOO_LONG: 'Ngồi quá lâu',
  EYE_BREAK: 'Nghỉ mắt',
}

export const alertLabel = (type: string | null | undefined) =>
  type ? (ALERT_LABEL[type] ?? type) : '—'

/**
 * Trạng thái thiết bị. Màu KHÔNG được đứng một mình: luôn đi cùng icon + label
 * (đỏ/lục khó phân biệt với người mù màu).
 */
export const STATE_META: Record<DeviceState, { label: string; icon: LucideIcon; color: string }> = {
  GOOD: { label: 'Ngồi đúng', icon: CircleCheck, color: colors.status.good },
  BAD: { label: 'Đang ngồi sai', icon: TriangleAlert, color: colors.status.bad },
  AWAY: { label: 'Vắng mặt', icon: Moon, color: colors.status.away },
  OFFLINE: { label: 'Không kết nối', icon: CircleOff, color: colors.status.offline },
}

export const ROLE_LABEL: Record<Role, string> = {
  USER: 'Nhân viên',
  ORG_ADMIN: 'Quản lý tổ chức',
  SYS_ADMIN: 'Quản trị hệ thống',
}

export const roleLabel = (r: string | null | undefined) => (r ? (ROLE_LABEL[r as Role] ?? r) : '—')
