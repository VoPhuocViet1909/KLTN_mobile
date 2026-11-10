// Chép từ GIT_frontend/src/lib/api/types.ts (commit 9d5677d), giữ đồng bộ khi web đổi
// Kiểu dữ liệu dùng chung, theo team-sync mục 3 và 4.1 (repo backend).

export type Role = 'USER' | 'ORG_ADMIN' | 'SYS_ADMIN'

export interface SessionUser {
  id: string
  name?: string | null
  email?: string
  orgId: string | null
  role: Role
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginResponse extends TokenPair {
  user: SessionUser
}

export interface Page<T> {
  items: T[]
  page: number
  size: number
  total: number
}

/** Body lỗi chuẩn của mọi service: {code, message, traceId, errors[{field, message}]} */
export interface ApiErrorBody {
  code: string
  message: string
  traceId?: string | null
  errors?: { field: string; message: string }[]
}
