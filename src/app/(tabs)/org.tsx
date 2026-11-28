// Dựa trên GIT_frontend/src/pages/OrgOverviewPage.tsx + OrgMembersPage.tsx (commit 9d5677d).
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { CalendarRange, ChevronRight, ShieldAlert, ShieldCheck, Users } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useOrgHeatmap, useOrgMembers, useOrgSummary, useOrgTimeseries, type OrgMember } from '@/api/org'
import { sumAlerts } from '@/api/stats'
import { displayUser, useUserDirectory } from '@/api/users'
import { isOrgAdmin, useAuth } from '@/auth/context'
import { HabitHeatmap } from '@/components/charts/HabitHeatmap'
import { BadMinutesBars, DayDetail, fillDays, ScoreLine } from '@/components/charts/ScoreTrend'
import { Forbidden } from '@/components/Forbidden'
import { Screen } from '@/components/Screen'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, EmptyState, ErrorState, Fact, LoadingState, Segmented, SectionTitle } from '@/components/ui'
import { alertLabel, STATE_META } from '@/lib/labels'
import { formatDateTime, formatMinutes } from '@/lib/time'
import { latestObservationByUser, type ObservationState } from '@/realtime/observation'
import { useObservations } from '@/realtime/ObservationProvider'
import { colors, radius, space, text } from '@/theme/tokens'

const RANGES = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
]
const STATES: ObservationState[] = ['GOOD', 'BAD', 'AWAY', 'CALIBRATING', 'CAMERA_LOST', 'UNKNOWN', 'OFFLINE']

export default function OrgScreen() {
  const { user } = useAuth()
  // Tab ẩn với role khác, nhưng link trực tiếp vẫn tới được route này: hiện 403, không gọi API.
  if (!isOrgAdmin(user)) return <Forbidden />
  return <Org />
}

function Org() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [days, setDays] = useState(7)
  const [picked, setPicked] = useState<number | null>(null)
  const summary = useOrgSummary(days)
  const series = useOrgTimeseries(days, 'day')
  const members = useOrgMembers(days)
  const weeks = Math.ceil(days / 7)
  const heatmap = useOrgHeatmap(weeks)
  // Tra tên: lỗi thì danh sách rơi về mã rút gọn, không báo lỗi riêng.
  const directory = useUserDirectory()
  const nameOf = (userId: string) => displayUser(directory.data, userId)

  const { connected, devices } = useObservations()
  const bad = devices.filter((device) => device.state === 'BAD')
  const countOf = (state: ObservationState) => devices.filter((device) => device.state === state).length
  const stateOfUser = useMemo(() => latestObservationByUser(devices), [devices])

  const s = summary.data
  const badShare = s && s.presenceMinutes > 0 ? Math.round((s.badMinutes / s.presenceMinutes) * 100) : null
  const topAlert = s ? Object.entries(s.alerts).sort((a, b) => b[1] - a[1])[0] : undefined
  const points = series.data ? fillDays(series.data, days) : []
  const hasSeries = points.some((p) => p.presenceMinutes > 0)

  return (
    <Screen
      title="Tổ chức"
      subtitle="Sức khỏe tư thế của cả tổ chức."
      onRefresh={() => Promise.all([summary.refetch(), series.refetch(), members.refetch(), directory.refetch(), heatmap.refetch(), queryClient.invalidateQueries({ queryKey: ['insights', 'org'] }), queryClient.invalidateQueries({ queryKey: ['stats', 'org', 'department-report'] })])}>
      <Card>
        <SectionTitle>Ai đang ngồi sai lúc này</SectionTitle>
        {!connected ? (
          <Text style={text.body}>Đang mất kết nối cập nhật trạng thái.</Text>
        ) : devices.length === 0 ? (
          <Text style={text.body}>Chưa có trạng thái mới từ Desktop App trong tổ chức.</Text>
        ) : (
          <>
            <View style={styles.counts}>
              {STATES.map((st) => (
                <View key={st} style={styles.count} accessible accessibilityLabel={`${STATE_META[st].label}, ${countOf(st)} máy`}>
                  <StatusBadge state={st} />
                  <Text style={text.bodyStrong}>{countOf(st)} máy</Text>
                </View>
              ))}
            </View>
            {bad.length === 0 ? (
              <Text style={text.body}>Chưa ghi nhận máy nào đang báo tư thế sai.</Text>
            ) : (
              bad.map((d) => (
                <View key={`${d.userId}:${d.deviceId}`} style={styles.badRow} accessible>
                  <Text style={[text.bodyStrong, styles.flex]}>{nameOf(d.userId)}</Text>
                  <Text style={text.caption}>{formatDateTime(d.receivedAt)}</Text>
                </View>
              ))
            )}
          </>
        )}
        <Text style={text.caption}>Mỗi trạng thái có hiệu lực tối đa 15 giây.</Text>
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

      <NavCard
        icon={ShieldAlert}
        title="Nguy cơ sức khỏe tổ chức"
        hint="Số người ở từng mức nguy cơ, theo cả tổ chức hoặc từng phòng ban (7 hoặc 30 ngày)."
        onPress={() => router.push('/org-health-risks')}
      />
      <NavCard
        icon={CalendarRange}
        title="Báo cáo phòng ban theo tuần"
        hint="Thời gian có mặt, tỷ lệ ngồi sai và cảnh báo của từng phòng ban trong một tuần đã kết thúc."
        onPress={() => router.push('/org-departments')}
      />

      <Card>
        <SectionTitle>Thói quen cả tổ chức</SectionTitle>
        {heatmap.isPending ? (
          <LoadingState />
        ) : heatmap.error ? (
          <ErrorState message={`Không tải được bản đồ thói quen: ${heatmap.error.message}`} onRetry={() => heatmap.refetch()} />
        ) : !heatmap.data.some((c) => c.meanScore !== null) ? (
          <EmptyState title={`Chưa có dữ liệu trong ${weeks} tuần qua.`} />
        ) : (
          <>
            <HabitHeatmap cells={heatmap.data} />
            <Text style={text.caption}>Điểm tư thế trung bình cả tổ chức theo thứ và giờ, {weeks} tuần gần nhất.</Text>
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
            state={stateOfUser.get(m.userId)?.state}
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

function NavCard({ icon: Icon, title, hint, onPress }: { icon: typeof ShieldAlert; title: string; hint: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      <Card>
        <View style={styles.navRow}>
          <Icon size={20} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={text.section}>{title}</Text>
            <Text style={text.caption}>{hint}</Text>
          </View>
          <ChevronRight size={18} color={colors.mutedForeground} />
        </View>
      </Card>
    </Pressable>
  )
}

function MemberRow({ member: m, name, state, onPress }: { member: OrgMember; name: string; state?: ObservationState; onPress: () => void }) {
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
  navRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
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
