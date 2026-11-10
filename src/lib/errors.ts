// Chép từ GIT_frontend/src/lib/api/errors.ts (commit 9d5677d), giữ đồng bộ khi web đổi
import { isAxiosError } from 'axios'
import type { ApiErrorBody } from './types'

/** Lỗi của Gateway khi tổ chức bị tạm ngưng / không kiểm tra được (docs/organization-access.md). */
export const ORGANIZATION_INACTIVE = 'ORGANIZATION_INACTIVE'
export const ORGANIZATION_UNAVAILABLE = 'ORGANIZATION_UNAVAILABLE'
export const MSG_ORG_INACTIVE =
  'Tổ chức của bạn đang tạm ngưng nên tài khoản không dùng được. Liên hệ quản trị hệ thống để bật lại.'
export const MSG_SESSION_ENDED =
  'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại; nếu không vào được, tài khoản có thể bị khóa hoặc tổ chức đang tạm ngưng.'
export const MSG_ORG_UNAVAILABLE = 'Chưa kiểm tra được trạng thái tổ chức của bạn. Hãy thử lại sau ít phút.'
export const MSG_NETWORK = 'Không kết nối được máy chủ'

/** Lỗi đã chuẩn hóa. Rẽ nhánh theo `code`, không theo `message`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId: string | null
  /** Lỗi theo trường (VALIDATION_FAILED): field -> message, để gắn vào đúng ô nhập */
  readonly fieldErrors: Record<string, string>

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message || 'Đã có lỗi xảy ra')
    this.name = 'ApiError'
    this.status = status
    this.code = body.code || (status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR')
    this.traceId = body.traceId ?? null
    this.fieldErrors = Object.fromEntries((body.errors ?? []).map((e) => [e.field, e.message]))
  }
}

/** Đổi mọi lỗi (axios, mạng, code) thành ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (isAxiosError(err)) {
    if (!err.response) {
      return new ApiError(0, { message: MSG_NETWORK })
    }
    const data = err.response.data as Partial<ApiErrorBody> | undefined
    // mock_server.py cũ trả {error}; vẫn đọc được
    const legacy = (err.response.data as { error?: string } | undefined)?.error
    const status = err.response.status
    const code = typeof data === 'object' ? data?.code : undefined
    // Hai lỗi này do Gateway trả cho mọi API: thay bằng câu tiếng Việt nói rõ chuyện gì và làm gì tiếp.
    // (409 ORGANIZATION_INACTIVE của phòng ban là lỗi khác, giữ nguyên.)
    const friendly =
      status === 403 && code === ORGANIZATION_INACTIVE
        ? MSG_ORG_INACTIVE
        : status === 503 && code === ORGANIZATION_UNAVAILABLE
          ? MSG_ORG_UNAVAILABLE
          : undefined
    return new ApiError(status, {
      ...(typeof data === 'object' ? data : {}),
      message: friendly || data?.message || legacy || err.message,
    })
  }
  return new ApiError(-1, { message: err instanceof Error ? err.message : String(err) })
}
