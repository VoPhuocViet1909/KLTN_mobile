import { History as HistoryIcon } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMyAlerts, useMySessions, type AlertItem, type SessionItem } from '@/api/alerts'
import { Card, EmptyState, ErrorState, LoadingState, Segmented } from '@/components/ui'
import { ALERT_LABEL, alertEndLabel, alertLabel, severityLabel, sessionEndLabel } from '@/lib/labels'
import { formatDateTime, formatDuration } from '@/lib/time'
import { colors, fonts, radius, space, text } from '@/theme/tokens'

type Tab = 'alerts' | 'sessions'
const RANGES = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 92, label: '92 ngày' },
]
const TABS = [
  { value: 'alerts' as Tab, label: 'Cảnh báo' },
  { value: 'sessions' as Tab, label: 'Phiên làm việc' },
]

/** Thời lượng phiên: tới lúc kết thúc, hoặc tới lần cuối thấy dữ liệu nếu còn mở. */
function sessionSeconds(s: SessionItem) {
  const end = s.endedAt ?? s.lastSeenAt
  if (!s.startedAt || !end) return null
  return (new Date(end).getTime() - new Date(s.startedAt).getTime()) / 1000
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('alerts')
  const [days, setDays] = useState(7)
  const [type, setType] = useState<string | undefined>(undefined)

  const alerts = useMyAlerts(days, type)
  const sessions = useMySessions(days)
  const q = tab === 'alerts' ? alerts : sessions
  const [refreshing, setRefreshing] = useState(false)

  const items = useMemo<(AlertItem | SessionItem)[]>(
    () => ((q.data?.pages ?? []) as { items: (AlertItem | SessionItem)[] }[]).flatMap((p) => p.items),
    [q.data],
  )
  const total = q.data?.pages[0]?.total ?? 0

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await q.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [q])

  const header = (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={text.title}>
        Lịch sử
      </Text>
      <Segmented label="Loại lịch sử" options={TABS} value={tab} onChange={setTab} />
      <Segmented label="Khoảng thời gian" options={RANGES} value={days} onChange={setDays} />
      {tab === 'alerts' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Tất cả loại" on={type === undefined} onPress={() => setType(undefined)} />
          {Object.entries(ALERT_LABEL).map(([key, label]) => (
            <Chip key={key} label={label} on={type === key} onPress={() => setType(key)} />
          ))}
        </ScrollView>
      )}
      {!q.isPending && !q.error ? <Text style={text.caption}>{total} mục</Text> : null}
    </View>
  )

  return (
    <FlatList<AlertItem | SessionItem>
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      data={items}
      keyExtractor={(it, i) =>
        'alertType' in it ? `${it.sessionId}|${it.deviceId}|${it.alertType}|${it.startedAt}` : `${it.sessionId}|${it.deviceId}|${i}`
      }
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <Card style={styles.row}>{'alertType' in item ? <AlertRow a={item} /> : <SessionRow s={item} />}</Card>
      )}
      ListEmptyComponent={
        q.isPending ? (
          <LoadingState />
        ) : q.error ? (
          <ErrorState message={`Không tải được lịch sử: ${q.error.message}`} onRetry={() => q.refetch()} />
        ) : (
          <Card>
            <EmptyState
              icon={HistoryIcon}
              title={tab === 'alerts' ? 'Không có cảnh báo nào trong khoảng này.' : 'Không có phiên làm việc nào trong khoảng này.'}
              hint="Thử chọn khoảng thời gian dài hơn."
            />
          </Card>
        )
      }
      ListFooterComponent={
        q.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={{ margin: space.lg }} />
        ) : q.error && items.length > 0 ? (
          <ErrorState message={`Không tải thêm được: ${q.error.message}`} onRetry={() => q.fetchNextPage()} />
        ) : undefined
      }
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage && !q.error) void q.fetchNextPage()
      }}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
    />
  )
}

function AlertRow({ a }: { a: AlertItem }) {
  return (
    <View
      style={styles.rowBody}
      accessible
      accessibilityLabel={`${alertLabel(a.alertType)}, ${formatDateTime(a.startedAt)}, thời lượng ${formatDuration(a.durationSec)}, ${a.open ? 'đang diễn ra' : alertEndLabel(a.endReason)}`}>
      <View style={styles.rowTop}>
        <Text style={[text.bodyStrong, styles.flex]}>{alertLabel(a.alertType)}</Text>
        <Text style={styles.pill}>{a.open ? 'Đang diễn ra' : severityLabel(a.severity)}</Text>
      </View>
      <Text style={text.caption}>{formatDateTime(a.startedAt)}</Text>
      <Text style={text.body}>
        Kéo dài {formatDuration(a.durationSec)}
        {a.repeatCount > 0 ? ` · nhắc lại ${a.repeatCount} lần` : ''}
      </Text>
      {!a.open && <Text style={text.caption}>{alertEndLabel(a.endReason)}</Text>}
    </View>
  )
}

function SessionRow({ s }: { s: SessionItem }) {
  return (
    <View
      style={styles.rowBody}
      accessible
      accessibilityLabel={`Phiên ${formatDateTime(s.startedAt)}, ${s.alertCount} cảnh báo, ${s.open ? 'đang mở' : sessionEndLabel(s.endReason)}`}>
      <View style={styles.rowTop}>
        <Text style={[text.bodyStrong, styles.flex]}>{formatDateTime(s.startedAt)}</Text>
        <Text style={styles.pill}>{s.open ? 'Đang mở' : 'Đã đóng'}</Text>
      </View>
      <Text style={text.body}>
        Kéo dài {formatDuration(sessionSeconds(s))} · {s.alertCount} cảnh báo
      </Text>
      <Text style={text.caption}>Máy: {s.deviceId}</Text>
      {!s.open && <Text style={text.caption}>{sessionEndLabel(s.endReason)}</Text>}
    </View>
  )
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  header: { gap: space.md, marginBottom: space.sm },
  chips: { gap: space.sm, paddingVertical: 2 },
  chip: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.primary },
  chipLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  chipLabelOn: { color: colors.primary },
  row: { padding: space.md },
  rowBody: { gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  flex: { flexShrink: 1 },
  pill: { ...text.caption, color: colors.foreground },
})
