import { Moon } from 'lucide-react-native'
import { StyleSheet, Text, View } from 'react-native'
import { sumAlerts, useTodaySummary } from '@/api/stats'
import { useAuth } from '@/auth/context'
import { Screen } from '@/components/Screen'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, EmptyState, ErrorState, Fact, LoadingState, SectionTitle } from '@/components/ui'
import { alertLabel } from '@/lib/labels'
import { formatDateTime, formatMinutes } from '@/lib/time'
import { useRealtimeConnected } from '@/realtime/hooks'
import { useMyDevices } from '@/realtime/StatusProvider'
import { colors, fonts, space, text } from '@/theme/tokens'

export default function TodayScreen() {
  const { user } = useAuth()
  const summary = useTodaySummary()
  const devices = useMyDevices(user?.id)
  const connected = useRealtimeConnected()
  const current = devices[0] ?? null

  const s = summary.data
  const topAlert = s ? Object.entries(s.alerts).sort((a, b) => b[1] - a[1])[0] : undefined
  const totalAlerts = s ? sumAlerts(s.alerts) : 0

  return (
    <Screen
      title="Hôm nay"
      subtitle={user?.name ? `Xin chào, ${user.name}` : undefined}
      onRefresh={() => summary.refetch()}>
      <Card>
        <View style={styles.cardHead}>
          <Text style={text.caption}>Tư thế lúc này</Text>
          <ConnectionChip connected={connected} />
        </View>
        {current ? (
          <View style={styles.statusBody}>
            <StatusBadge state={current.state} size="lg" />
            {current.state === 'BAD' && current.alertType ? (
              <Text style={text.section}>{alertLabel(current.alertType)}</Text>
            ) : null}
            <Text style={text.caption}>Cập nhật {formatDateTime(current.ts)}</Text>
            {devices.length > 1 ? <Text style={text.caption}>{devices.length} máy đang gửi dữ liệu</Text> : null}
          </View>
        ) : (
          <EmptyState
            icon={Moon}
            title="Chưa có dữ liệu tư thế"
            hint="Mở ứng dụng desktop, đăng nhập cùng tài khoản và hiệu chỉnh camera để xem tư thế tại đây."
          />
        )}
      </Card>

      <Card>
        <SectionTitle>Số liệu hôm nay</SectionTitle>
        {summary.isPending ? (
          <LoadingState />
        ) : summary.error ? (
          <ErrorState message={`Không tải được số liệu: ${summary.error.message}`} onRetry={() => summary.refetch()} />
        ) : s ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroValue} accessibilityLabel={`Điểm tư thế trung bình ${s.meanScore === null ? 'chưa có' : Math.round(s.meanScore)} trên 100`}>
                {s.meanScore === null ? '—' : Math.round(s.meanScore)}
                <Text style={styles.heroUnit}>/100</Text>
              </Text>
              <Text style={text.caption}>Điểm tư thế trung bình</Text>
            </View>
            <View style={styles.facts}>
              <Fact label="Ngồi sai" value={formatMinutes(s.badMinutes)} />
              <Fact label="Có mặt" value={formatMinutes(s.presenceMinutes)} />
              <Fact
                label="Cảnh báo"
                value={String(totalAlerts)}
                hint={topAlert ? `nhiều nhất: ${alertLabel(topAlert[0])}` : undefined}
              />
            </View>
            {s.presenceMinutes === 0 && totalAlerts === 0 ? (
              <Text style={text.caption}>Chưa có dữ liệu hôm nay.</Text>
            ) : null}
          </>
        ) : null}
      </Card>
    </Screen>
  )
}

/** Tình trạng kết nối realtime tới máy chủ. Dùng màu primary/offline, không dùng xanh GOOD (design system mục 1). */
function ConnectionChip({ connected }: { connected: boolean }) {
  const color = connected ? colors.primary : colors.status.offline
  return (
    <View style={styles.chip} accessible accessibilityLabel={connected ? 'Đang đồng bộ trực tiếp' : 'Chưa kết nối máy chủ'}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={text.caption}>{connected ? 'Đang đồng bộ' : 'Chưa kết nối máy chủ'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  statusBody: { gap: space.sm, paddingVertical: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hero: { gap: 2 },
  heroValue: { ...text.hero, fontVariant: ['tabular-nums'] },
  heroUnit: { fontFamily: fonts.regular, fontSize: 18, color: colors.mutedForeground },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
})
