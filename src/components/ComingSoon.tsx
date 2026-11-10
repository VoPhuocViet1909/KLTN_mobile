import { Hourglass } from 'lucide-react-native'
import { Screen } from './Screen'
import { Card, EmptyState } from './ui'

/** Màn tạm cho tab chưa làm (các prompt sau). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <Card>
        <EmptyState icon={Hourglass} title="Sắp có" hint="Màn hình này đang được xây dựng." />
      </Card>
    </Screen>
  )
}
