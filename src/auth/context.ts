import { createContext, useContext } from 'react'
import type { Role, SessionUser } from '@/lib/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  user: SessionUser | null
  status: AuthStatus
  /** Lý do cần nói ở màn đăng nhập (hết phiên, tổ chức tạm ngưng). */
  notice: string | null
  login: (email: string, password: string) => Promise<SessionUser>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider')
  return ctx
}

export const hasRole = (user: SessionUser | null, roles?: Role[]) =>
  !!user && (!roles || roles.includes(user.role))

/** Màn "Tổ chức": chỉ ORG_ADMIN có tổ chức (team-sync 4.6: /stats/org/* yêu cầu orgId, còn lại nhận 403). */
export const isOrgAdmin = (user: SessionUser | null) => user?.role === 'ORG_ADMIN' && !!user.orgId
