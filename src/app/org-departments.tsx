// Dựa trên GIT_frontend/src/components/HistoricalDepartmentReport.tsx (commit a500d43).
import { useRouter } from 'expo-router'
import { ChevronRight, ShieldCheck } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useDepartmentReport, type DepartmentReportRow } from '@/api/departmentReport'
import { useDepartments } from '@/api/org'
import { isOrgAdmin, useAuth } from '@/auth/context'
import { Forbidden } from '@/components/Forbidden'
import { Screen } from '@/components/Screen'
import { Button, Card, EmptyState, ErrorState, Fact, LoadingState } from '@/components/ui'
import { badRatioText, canOpenHealth, hiddenMessage, reportHidden, rowLabel } from '@/lib/departmentReport'
import { toApiError } from '@/lib/errors'
import { formatDateTime, formatDuration } from '@/lib/time'
import { canGoEarlier, canGoLater, defaultReportWeek, formatWeekRange, shiftWeek } from '@/lib/week'
import { colors, radius, space, text } from '@/theme/tokens'

export default function OrgDepartmentsRoute() {
  const { user } = useAuth()
  // Link trực tiếp bằng role khác: hiện 403, không gọi API nào.
  if (!isOrgAdmin(user) || !user?.orgId) return <Forbidden title="Báo cáo phòng ban" back="Tổ chức" />
  return <OrgDepartments orgId={user.orgId} />
}

function OrgDepartments({ orgId }: { orgId: string }) {
  const router = useRouter()
  const [week, setWeek] = useState(() => defaultReportWeek())
  const report = useDepartmentReport(week)
  const departments = useDepartments(orgId)
  const names = useMemo(() => new Map((departments.data ?? []).map((d) => [d.id, d.name])), [departments.data])
  const data = report.data
  const err = report.error ? toApiError(report.error) : null

  return (
    <Screen
      title="Báo cáo phòng ban"
      subtitle="Tuần đã kết thúc theo giờ Việt Nam. Dữ liệu gán theo phòng ban tại lúc phát sinh."
      back="Tổ chức"
      onRefresh={() => Promise.all([report.refetch(), departments.refetch()])}>
      <Card>
        <View style={styles.weekRow}>
          <Button label="Tuần trước" variant="outline" disabled={!canGoEarlier(week) || report.isFetching} onPress={() => setWeek(shiftWeek(week, -1))} />
          <Button label="Tuần sau" variant="outline" disabled={!canGoLater(week) || report.isFetching} onPress={() => setWeek(shiftWeek(week, 1))} />
        </View>
        <Text style={[text.section, { fontVariant: ['tabular-nums'] }]} accessibilityLiveRegion="polite">
          {formatWeekRange(week)}
        </Text>
        <Text style={text.caption}>Chọn được 13 tuần gần nhất. Mặc định là tuần trước.</Text>
      </Card>

      {report.isPending ? (
        <LoadingState />
      ) : err ? (
        <ErrorState
          message={
            err.status === 403
              ? 'Bạn không có quyền xem báo cáo phòng ban. Chỉ quản lý tổ chức mới xem được.'
              : err.status === 503
                ? 'Lịch sử phòng ban tạm thời chưa sẵn sàng nên chưa có báo cáo đầy đủ. Hãy thử lại sau ít phút.'
                : err.status === 400
                  ? 'Tuần này nằm ngoài 13 tuần gần nhất nên không có báo cáo.'
                  : `Không tải được báo cáo phòng ban: ${err.message}`
          }
          onRetry={() => report.refetch()}
        />
      ) : data ? (
        <>
          {reportHidden(data) ? (
            <Card accessibilityRole="alert">
              <Text style={text.body}>{hiddenMessage(data)}</Text>
            </Card>
          ) : data.status === 'NO_DATA' || data.rows.length === 0 ? (
            <Card>
              <EmptyState title="Chưa có dữ liệu hiện diện trong tuần này." />
            </Card>
          ) : (
            data.rows.map((r) => (
              <Row
                key={`${r.group}/${r.departmentId}`}
                row={r}
                name={rowLabel(r, names)}
                onOpenHealth={() => router.push({ pathname: '/org-health-risks', params: { departmentId: r.departmentId ?? '' } })}
              />
            ))
          )}
          <Text style={text.caption}>
            Tỷ lệ sai = giây sai / giây đã nhận diện từ timing thực; dữ liệu cũ chỉ đóng góp thời gian có mặt. Số người giữa các phòng có thể
            trùng khi chuyển phòng, không cộng thành tổng nhân viên. Cảnh báo là số đếm trong metric. Không dùng để xếp hạng năng suất.
          </Text>
          <Text style={text.caption}>
            Chưa có lịch sử và cửa sổ cắt mốc chuyển được tách riêng; cửa sổ cắt ranh giới tuần không tính. Dữ liệu đến muộn có thể bổ sung
            tuần cũ. Cập nhật {formatDateTime(data.dataAsOf)}.
          </Text>
        </>
      ) : null}

      <View style={styles.privacy}>
        <ShieldCheck size={16} color={colors.mutedForeground} />
        <Text style={[text.caption, styles.flex]}>Quyền riêng tư: chỉ số liệu tổng hợp theo phòng ban, không có hình ảnh hay tên từng người.</Text>
      </View>
    </Screen>
  )
}

function Row({ row, name, onOpenHealth }: { row: DepartmentReportRow; name: string; onOpenHealth: () => void }) {
  const open = canOpenHealth(row)
  const noData = row.status === 'NO_DATA'
  const hidden = row.status === 'SUPPRESSED' || row.status === 'OVERLAPPING_WINDOWS'
  const body = (
    <Card>
      <View style={styles.head}>
        <Text style={[text.section, styles.flex]}>{name}</Text>
        {open ? <ChevronRight size={18} color={colors.mutedForeground} /> : null}
      </View>
      {noData ? (
        <Text style={text.body}>Chưa có dữ liệu trong tuần này.</Text>
      ) : hidden ? (
        <Text style={text.body}>Số liệu được ẩn.</Text>
      ) : (
        <View style={styles.facts}>
          <Fact label="Người có dữ liệu" value={row.contributors === null ? '—' : String(row.contributors)} />
          <Fact label="Có mặt" value={formatDuration(row.presenceSec)} />
          <Fact label="Đã nhận diện" value={formatDuration(row.knownSec)} />
          <Fact label="Tỷ lệ sai" value={badRatioText(row.badRatio)} />
          <Fact label="Cảnh báo" value={row.alertCount === null ? '—' : String(row.alertCount)} />
        </View>
      )}
      {open ? <Text style={[text.caption, { color: colors.primary }]}>Chạm để xem nguy cơ sức khỏe của phòng này</Text> : null}
    </Card>
  )
  if (!open) return body
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name}. Chạm để xem nguy cơ sức khỏe của phòng này`} onPress={onOpenHealth} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  weekRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  privacy: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', borderRadius: radius.control },
})
