// Dựa trên GIT_frontend/src/lib/api/users.ts (commit 9d5677d): chỉ phần tra tên (useUserDirectory, displayUser).
// Mobile không quản lý nhân viên (để trên web), nên không chép các hook tạo/sửa.
import { useQuery } from '@tanstack/react-query'
import { request } from './client'
import type { Paged } from './alerts'
import type { Role } from '@/lib/types'

// auth-service – team-sync mục 4.1 (GET /users: ORG_ADMIN, SYS_ADMIN)

export interface UserAccount {
  id: string
  email: string
  name: string | null
  role: Role
  orgId: string | null
  enabled: boolean
  /** phòng ban (organization-service); null khi chưa gán */
  departmentId: string | null
}

/**
 * Tra userId -> tài khoản (để hiện tên thay vì mã). ORG_ADMIN chỉ thấy người cùng tổ chức.
 * Lấy tối đa 5 trang × 100 = 500 người; thiếu hoặc lỗi thì nơi dùng rơi về mã rút gọn.
 */
export function useUserDirectory(enabled = true) {
  return useQuery({
    queryKey: ['users', 'directory'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const map: Record<string, UserAccount> = {}
      for (let page = 0; page < 5; page++) {
        const res = await request<Paged<UserAccount>>({ url: '/users', params: { page, size: 100 } })
        for (const u of res.items) map[u.id] = u
        if ((page + 1) * res.size >= res.total || res.items.length === 0) break
      }
      return map
    },
  })
}

/** Tên hiển thị: tên, rồi email; không tra được thì 8 ký tự đầu của userId. */
export function displayUser(dir: Record<string, UserAccount> | undefined, userId: string) {
  const u = dir?.[userId]
  return u?.name || u?.email || userId.slice(0, 8)
}
