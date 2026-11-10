import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, Inbox } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type AlertItem } from '@/api/alerts'
import { useOrgMemberAlerts } from '@/api/org'
import { displayUser, useUserDirectory } from '@/api/users'
import { isOrgAdmin, useAuth } from '@/auth/context'
import { AlertRow } from '@/components/AlertRow'
import { Forbidden } from '@/components/Forbidden'
import { useTopInset } from '@/components/topInset'
import { Card, EmptyState, ErrorState, LoadingState, Segmented } from '@/components/ui'
import { colors, space, text } from '@/theme/tokens'

const RANGES = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 92, label: '92 ngày' },
]

/** Cảnh báo của một nhân viên trong tổ chức (GET /alerts/org?userId=). Chỉ ORG_ADMIN. */
export default function MemberScreen() {
  const { user } = useAuth()
  if (!isOrgAdmin(user)) return <Forbidden title="Nhân viên" />
  return <Member />
}

function Member() {
  const router = useRouter()
  const topInset = useTopInset()
  const { userId, days: daysParam } = useLocalSearchParams<{ userId: string; days?: string }>()
  const insets = useSafeAreaInsets()
  const [days, setDays] = useState(RANGES.some((r) => String(r.value) === daysParam) ? Number(daysParam) : 7)
  const directory = useUserDirectory()
  const q = useOrgMemberAlerts(userId, days)
  const [refreshing, setRefreshing] = useState(false)
  const items = useMemo<AlertItem[]>(() => (q.data?.pages ?? []).flatMap((p) => p.items), [q.data])
  const total = q.data?.pages[0]?.total ?? 0
  const name = displayUser(directory.data, userId)

  async function refresh() {
    setRefreshing(true)
    try {
      await q.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <FlatList<AlertItem>
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingTop: topInset + space.sm, paddingBottom: insets.bottom + space.xxl }]}
      data={items}
      keyExtractor={(a) => `${a.sessionId}|${a.deviceId}|${a.alertType}|${a.startedAt}`}
      ListHeaderComponent={
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/org'))}
            accessibilityRole="button"
            accessibilityLabel="Quay lại màn Tổ chức"
            style={styles.back}>
            <ChevronLeft size={20} color={colors.primary} />
            <Text style={[text.bodyStrong, { color: colors.primary }]}>Tổ chức</Text>
          </Pressable>
          <Text accessibilityRole="header" style={text.title}>
            {name}
          </Text>
          <Segmented label="Khoảng thời gian" options={RANGES} value={days} onChange={setDays} />
          {!q.isPending && !q.error ? <Text style={text.caption}>{total} cảnh báo</Text> : null}
        </View>
      }
      renderItem={({ item }) => (
        <Card style={styles.row}>
          <AlertRow a={item} />
        </Card>
      )}
      ListEmptyComponent={
        q.isPending ? (
          <LoadingState />
        ) : q.error ? (
          <ErrorState message={`Không tải được cảnh báo: ${q.error.message}`} onRetry={() => q.refetch()} />
        ) : (
          <Card>
            <EmptyState icon={Inbox} title="Không có cảnh báo nào trong khoảng này." hint="Thử chọn khoảng thời gian dài hơn." />
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

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.lg, gap: space.md },
  header: { gap: space.md, marginBottom: space.sm },
  row: { padding: space.md },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' },
})
