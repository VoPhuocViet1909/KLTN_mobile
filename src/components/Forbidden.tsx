import { ShieldOff } from 'lucide-react-native'
import { Screen } from './Screen'
import { Card, EmptyState } from './ui'

/** Màn 403: vào được đường dẫn nhưng không đủ quyền (vd. mở trực tiếp link màn "Tổ chức" bằng tài khoản không phải ORG_ADMIN). */
export function Forbidden({ title = 'Tổ chức' }: { title?: string }) {
  return (
    <Screen title={title}>
      <Card>
        <EmptyState
          icon={ShieldOff}
          title="Bạn không có quyền xem màn hình này"
          hint="Màn hình này chỉ dành cho quản lý tổ chức. Nếu cần xem, hãy liên hệ quản trị viên của tổ chức."
        />
      </Card>
    </Screen>
  )
}
