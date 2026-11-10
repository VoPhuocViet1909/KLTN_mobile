// Dựa trên GIT_frontend/src/pages/OrgOverviewPage.tsx + OrgMembersPage.tsx (commit 9d5677d).
import { useRouter } from 'expo-router'
import { ChevronRight, ShieldCheck, Users } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useOrgMembers, useOrgSummary, useOrgTimeseries, type OrgMember } from '@/api/org'
import { sumAlerts } from '@/api/stats'
import { displayUser, useUserDirectory } from '@/api/users'
import { isOrgAdmin, useAuth } from '@/auth/context'
import { BadMinutesBars, DayDetail, fillDays, ScoreLine } from '@/components/charts/ScoreTrend'
import { Forbidden } from '@/components/Forbidden'
import { Screen } from '@/components/Screen'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, EmptyState, ErrorState, Fact, LoadingState, Segmented, SectionTitle } from '@/components/ui'
import { alertLabel } from '@/lib/labels'
import { formatDateTime, formatMinutes } from '@/lib/time'
import type { DeviceState } from '@/realtime/socket'
import { useAllDevices } from '@/realtime/StatusProvider'
import { colors, radius, space, text } from '@/theme/tokens'

const RANGES = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
]
const STATES: DeviceState[] = ['GOOD', 'BAD', 'AWAY', 'OFFLINE']

export default function OrgScreen() {
  const { user } = useAuth()
  // Tab ẩn với role khác, nhưng link trực tiếp vẫn tới được route này: hiện 403, không gọi API.
  if (!isOrgAdmin(user)) return <Forbidden />
  return <Org />
}

function Org() {
  const router = useRouter()
  const [days, setDays] = useState(7)
  const [picked, setPicked] = useState<number | null>(null)
  const summary = useOrgSummary(days)
  const series = useOrgTimeseries(days, 'day')
  const members = useOrgMembers(days)
  // Tra tên: lỗi thì danh sách rơi về mã rút gọn, không báo lỗi riêng.
  const directory = useUserDirectory()
  const nameOf = (userId: string) => displayUser(directory.data, userId)

  // ORG_ADMIN tự ở room org:{orgId}: nhận `status` của mọi máy trong tổ chức từ lúc mở app.
  const devices = useAllDevices()
  const bad = useMemo(
    () => devices.filter((d) => d.state === 'BAD').sort((a, b) => b.ts.localeCompare(a.ts)),
    [devices],
  )
  const countOf = (st: DeviceState) => devices.filter((d) => d.state === st).length
  const stateOfUser = useMemo(() => {
    const m = new Map<string, DeviceState>()
    for (const d of [...devices].sort((a, b) => a.ts.localeCompare(b.ts))) m.set(d.userId, d.state)
    return m
  }, [devices])

  const s = summary.data
  const badShare = s && s.presenceMinutes > 0 ? Math.round((s.badMinutes / s.presenceMinutes) * 100) : null
  const topAlert = s ? Object.entries(s.alerts).sort((a, b) => b[1] - a[1])[0] : undefined
  const points = series.data ? fillDays(series.data, days) : []
  const hasSeries = points.some((p) => p.presenceMinutes > 0)

  return (
    <Screen
      title="Tổ chức"
      subtitle="Sức khỏe tư thế của cả tổ chức."
      onRefresh={() => Promise.all([summary.refetch(), series.refetch(), members.refetch(), directory.refetch()])}>
      <Card>
        <SectionTitle>Ai đang ngồi sai lúc này</SectionTitle>
        {devices.length === 0 ? (
          <Text style={text.body}>Chưa có máy nào gửi dữ liệu kể từ lúc bạn mở ứng dụng.</Text>
        ) : (
          <>
            <View style={styles.counts}>
              {STATES.map((st) => (
                <View key={st} style={styles.count} accessible accessibilityLabel={`${countOf(st)} máy ${st === 'GOOD' ? 'ngồi đúng' : st === 'BAD' ? 'ngồi sai' : st === 'AWAY' ? 'vắng mặt' : 'không kết nối'}`}>
                  <StatusBadge state={st} />
                  <Text style={text.bodyStrong}>{countOf(st)} máy</Text>
                </View>
              ))}
            </View>
            {bad.length === 0 ? (
              <Text style={text.body}>Không ai đang ngồi sai.</Text>
            ) : (
              bad.map((d) => (
                <View key={`${d.userId}:${d.deviceId}`} style={styles.badRow} accessible>
                  <Text style={[text.bodyStrong, styles.flex]}>{nameOf(d.userId)}</Text>
                  <Text style={text.body}>{alertLabel(d.alertType)}</Text>
                  <Text style={text.caption}>{formatDateTime(d.ts)}</Text>
                </View>
              ))
            )}
          </>
        )}
        <Text style={text.caption}>Cập nhật trực tiếp, tính từ lúc bạn mở ứng dụng.</Text>
      </Card>

      <Segmented
        label="Khoảng thời gian"
        options={RANGES}
        value={days}
        onChange={(d) => {
          setDays(d)
          setPicked(null)
        }}
      />

      <Card>
        <SectionTitle>Tổng quan tổ chức</SectionTitle>
        {summary.isPending ? (
          <LoadingState />
        ) : summary.error ? (
          <ErrorState message={`Không tải được số liệu: ${summary.error.message}`} onRetry={() => summary.refetch()} />
        ) : s ? (
          <>
            <View>
              <Text style={styles.hero} accessibilityLabel={`Điểm tư thế trung bình cả tổ chức ${s.meanScore === null ? 'chưa có' : Math.round(s.meanScore)} trên 100`}>
                {s.meanScore === null ? '—' : Math.round(s.meanScore)}
                <Text style={styles.heroUnit}>/100</Text>
              </Text>
              <Text style={text.caption}>Điểm tư thế trung bình</Text>
            </View>
            <View style={styles.facts}>
              <Fact
                label="Thời gian ngồi sai"
                value={badShare === null ? '—' : `${badShare}%`}
                hint={`${Math.round(s.badMinutes)} / ${Math.round(s.presenceMinutes)} phút`}
              />
              <Fact label="Cảnh báo" value={String(sumAlerts(s.alerts))} hint={topAlert ? `nhiều nhất: ${alertLabel(topAlert[0])}` : undefined} />
              <Fact label="Có mặt" value={formatMinutes(s.presenceMinutes)} />
            </View>
          </>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Xu hướng theo ngày</SectionTitle>
        {series.isPending ? (
          <LoadingState />
        ) : series.error ? (
          <ErrorState message={`Không tải được biểu đồ: ${series.error.message}`} onRetry={() => series.refetch()} />
        ) : !hasSeries ? (
          <EmptyState title="Chưa có dữ liệu trong khoảng này." hint="Số liệu xuất hiện khi nhân viên mở ứng dụng desktop và đăng nhập." />
        ) : (
          <>
            <ScoreLine points={points} selected={picked} onSelect={setPicked} />
            <DayDetail point={picked === null ? null : (points[picked] ?? null)} />
            <Text style={text.section}>Phút ngồi sai mỗi ngày</Text>
            <BadMinutesBars points={points} onSelect={setPicked} />
          </>
        )}
      </Card>

      <SectionTitle>Nhân viên</SectionTitle>
      <Text style={text.caption}>Sắp theo thời gian ngồi sai nhiều nhất. Chạm một người để xem cảnh báo của họ.</Text>
      {members.isPending ? (
        <LoadingState />
      ) : members.error ? (
        <ErrorState message={`Không tải được số liệu nhân viên: ${members.error.message}`} onRetry={() => members.refetch()} />
      ) : members.data.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title={`Chưa có nhân viên nào có số liệu trong ${days} ngày qua.`} hint="Số liệu xuất hiện khi nhân viên mở ứng dụng desktop và đăng nhập." />
        </Card>
      ) : (
        members.data.map((m) => (
          <MemberRow
            key={m.userId}
            member={m}
            name={nameOf(m.userId)}
            state={stateOfUser.get(m.userId)}
            onPress={() => router.push({ pathname: '/member/[userId]', params: { userId: m.userId, days: String(days) } })}
          />
        ))
      )}

      <View style={styles.privacy}>
        <ShieldCheck size={16} color={colors.mutedForeground} />
        <Text style={[text.caption, styles.flex]}>
          Quyền riêng tư: ứng dụng chỉ hiển thị chỉ số tư thế của nhân viên. Không có hình ảnh hay video.
        </Text>
      </View>
    </Screen>
  )
}

function MemberRow({ member: m, name, state, onPress }: { member: OrgMember; name: string; state?: DeviceState; onPress: () => void }) {
  const badPct = m.presenceMinutes > 0 ? Math.round((m.badMinutes / m.presenceMinutes) * 100) : null
  const alerts = sumAlerts(m.alerts)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, điểm ${m.meanScore === null ? 'chưa có' : Math.round(m.meanScore)}, ngồi sai ${formatMinutes(m.badMinutes)}, ${alerts} cảnh báo. Chạm để xem chi tiết`}
      style={({ pressed }) => [styles.member, pressed && { opacity: 0.8 }]}>
      <View style={styles.flex}>
        <Text style={text.bodyStrong}>{name}</Text>
        <Text style={text.body}>
          Điểm {m.meanScore === null ? '—' : Math.round(m.meanScore)} · ngồi sai {formatMinutes(m.badMinutes)}
          {badPct === null ? '' : ` (${badPct}%)`}
        </Text>
        <Text style={text.caption}>
          {alerts} cảnh báo · có mặt {formatMinutes(m.presenceMinutes)}
        </Text>
        {state ? <StatusBadge state={state} /> : null}
      </View>
      <ChevronRight size={20} color={colors.mutedForeground} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flexShrink: 1, flex: 1, gap: 2 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.sm },
  count: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badRow: { gap: 2, paddingTop: space.sm, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  hero: { ...text.hero, fontVariant: ['tabular-nums'] },
  heroUnit: { ...text.section, color: colors.mutedForeground },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 64,
    padding: space.md,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.panel,
  },
  privacy: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
})
