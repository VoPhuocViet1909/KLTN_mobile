// Dựa trên GIT_frontend/src/pages/OrgHealthRisksPage.tsx (commit a500d43). Web hiện bảng nhiều nhóm; mobile chọn từng nhóm.
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useDepartments } from '@/api/org'
import { useOrgHealthRisks, type GroupRisk, type Period } from '@/api/insights'
import { isOrgAdmin, useAuth } from '@/auth/context'
import { Forbidden } from '@/components/Forbidden'
import { Screen } from '@/components/Screen'
import { Card, EmptyState, ErrorState, LoadingState, Segmented } from '@/components/ui'
import { DISCLAIMER, EVIDENCE_LABEL } from '@/lib/healthRisk'
import { insightErrorMessage } from '@/lib/insightError'
import { suppressedHealthMessage } from '@/lib/departmentReport'
import { formatDateTime } from '@/lib/time'
import { colors, radius, space, text } from '@/theme/tokens'

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
]

export default function OrgHealthRisksRoute() {
  const { user } = useAuth()
  // Link trực tiếp bằng role khác: hiện 403, không gọi API nào.
  if (!isOrgAdmin(user) || !user?.orgId) return <Forbidden title="Nguy cơ sức khỏe tổ chức" back="Tổ chức" />
  return <OrgHealthRisks orgId={user.orgId} />
}

function OrgHealthRisks({ orgId }: { orgId: string }) {
  const params = useLocalSearchParams<{ departmentId?: string }>()
  const [period, setPeriod] = useState<Period>('7d')
  const [departmentId, setDepartmentId] = useState<string | undefined>(params.departmentId || undefined)
  const departments = useDepartments(orgId)
  const q = useOrgHealthRisks(period, departmentId)
  const active = (departments.data ?? []).filter((d) => d.active || d.id === departmentId)
  const groups = [{ id: undefined as string | undefined, name: 'Toàn tổ chức' }, ...active.map((d) => ({ id: d.id as string | undefined, name: d.name }))]
  const selectedName =
    departmentId === undefined
      ? 'Toàn tổ chức'
      : (departments.data?.find((d) => d.id === departmentId)?.name ?? `Phòng ban ${departmentId.slice(0, 8)}`)
  const data = q.data

  return (
    <Screen
      title="Nguy cơ sức khỏe tổ chức"
      subtitle="Số người ở từng mức nguy cơ, tổng hợp ẩn danh."
      back="Tổ chức"
      onRefresh={() => Promise.all([q.refetch(), departments.refetch()])}>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} label="Khoảng thời gian" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist" accessibilityLabel="Chọn nhóm">
        {groups.map((g) => {
          const on = g.id === departmentId
          return (
            <Pressable
              key={g.id ?? 'all'}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setDepartmentId(g.id)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[text.bodyStrong, on && { color: colors.primaryForeground }]}>{g.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {departments.error ? (
        <Text style={text.caption}>Chưa tải được danh sách phòng ban; vẫn xem được cả tổ chức.</Text>
      ) : null}

      <View accessibilityRole="summary" style={styles.disclaimer}>
        <ShieldAlert size={18} color={colors.primary} />
        <Text style={[text.caption, styles.flex]}>
          <Text style={text.bodyStrong}>{data?.disclaimer ?? DISCLAIMER}</Text> Đây là thống kê nhóm, không đánh giá hay nhận diện từng người.
        </Text>
      </View>

      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={insightErrorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : data ? (
        data.status === 'SUPPRESSED' ? (
          <Card>
            <EmptyState icon={ShieldCheck} title={suppressedHealthMessage(data.minGroupSize)} hint={`${selectedName}. Không hiện số người hay mức nguy cơ.`} />
          </Card>
        ) : (
          <>
            <Card>
              <Text style={text.section}>{selectedName}</Text>
              <Text style={text.body}>{data.groupSize} người đủ dữ liệu trong {period === '7d' ? '7' : '30'} ngày.</Text>
              <Text style={text.caption}>Bảng tri thức {data.kbVersion}{data.generatedAt ? ` · cập nhật ${formatDateTime(data.generatedAt)}` : ""}</Text>
            </Card>
            {data.risks.length === 0 ? (
              <Card>
                <EmptyState title="Chưa có nguy cơ nào để hiển thị trong kỳ này." />
              </Card>
            ) : (
              data.risks.map((r) => <RiskCard key={r.kbId} risk={r} />)
            )}
            <Card>
              <Text style={text.bodyStrong}>Nguồn nghiên cứu</Text>
              <Text style={text.caption}>
                Số liệu tổng hợp của tổ chức không kèm nguồn. Mỗi nguy cơ dùng chung bảng tri thức với màn Nguy cơ sức khỏe của bạn; xem nguồn và cách tính ở đó (có liên kết ra ngoài).
              </Text>
              <OpenPersonal />
            </Card>
            {data.note ? <Text style={text.caption}>{data.note}</Text> : null}
          </>
        )
      ) : null}

      <View style={styles.privacy}>
        <ShieldCheck size={16} color={colors.mutedForeground} />
        <Text style={[text.caption, styles.flex]}>Quyền riêng tư: chỉ số liệu tổng hợp theo nhóm, không có hình ảnh hay tên từng người.</Text>
      </View>
    </Screen>
  )
}

function OpenPersonal() {
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Mở màn Nguy cơ sức khỏe có nguồn nghiên cứu"
      onPress={() => router.push('/health-risks')}
      style={styles.link}>
      <Text style={[text.bodyStrong, { color: colors.primary }]}>Xem nguồn ở màn Nguy cơ sức khỏe</Text>
      <ChevronRight size={14} color={colors.primary} />
    </Pressable>
  )
}

function RiskCard({ risk }: { risk: GroupRisk }) {
  const total = risk.low + risk.medium + risk.high
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  return (
    <Card accessible accessibilityLabel={`${risk.risk.vi}. ${risk.high} người mức cao, ${risk.medium} vừa, ${risk.low} thấp. Bằng chứng ${EVIDENCE_LABEL[risk.evidence]}`}>
      <Text style={text.section}>{risk.risk.vi}</Text>
      <Text style={text.caption}>{risk.risk.en} · Bằng chứng: {EVIDENCE_LABEL[risk.evidence]}</Text>
      <View style={styles.bar}>
        <View style={[styles.seg, { flex: pct(risk.high), backgroundColor: colors.destructive }]} />
        <View style={[styles.seg, { flex: pct(risk.medium), backgroundColor: colors.status.away }]} />
        <View style={[styles.seg, { flex: pct(risk.low), backgroundColor: colors.status.good }]} />
      </View>
      <View style={styles.counts}>
        <Text style={text.body}><Text style={text.bodyStrong}>{risk.high}</Text> cao</Text>
        <Text style={text.body}><Text style={text.bodyStrong}>{risk.medium}</Text> vừa</Text>
        <Text style={text.body}><Text style={text.bodyStrong}>{risk.low}</Text> thấp</Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { gap: space.sm, paddingVertical: 2 },
  chip: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.control,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  disclaimer: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', padding: space.md, borderRadius: radius.control,
    backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.border,
  },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.muted },
  seg: { height: 10 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
  privacy: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
})
