import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMyPostureClasses } from '@/api/stats'
import { Card, EmptyState, ErrorState, LoadingState, SectionTitle, Segmented } from '@/components/ui'
import {
  CLASS_COLOR, CLASS_LABEL, chartRows, classCoverage, classShares, STACK_ORDER, topBadClass, type ClassPoint,
} from '@/lib/postureClass'
import { formatMinutes, VN_TZ, vnDayStarts } from '@/lib/time'
import { colors, radius, space, text } from '@/theme/tokens'

const VIEWS = [
  { value: 'day', label: '7 ngày' },
  { value: 'week', label: '4 tuần' },
] as const
const DAYS = { day: 7, week: 28 } as const
const dayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, day: '2-digit', month: '2-digit' })

const BAR_H = 140

/** Cột chồng theo ngày/tuần (View thường, không cần thư viện): chiều cao theo phút, cột cao nhất = BAR_H. */
function StackedBars({ points, bucket }: { points: ClassPoint[]; bucket: 'day' | 'week' }) {
  const rows = chartRows(points, bucket === 'day' ? vnDayStarts(DAYS.day - 1) : null)
  const total = (r: (typeof rows)[number]) => STACK_ORDER.reduce((a, c) => a + r.minutes[c], 0)
  const max = Math.max(1, ...rows.map(total))
  return (
    <View
      accessible
      accessibilityLabel={`Biểu đồ cột chồng thời gian theo lớp tư thế, theo ${bucket === 'week' ? 'tuần' : 'ngày'}`}
      style={styles.bars}>
      {rows.map((r) => (
        <View key={r.start} style={styles.col}>
          <View style={[styles.stack, { height: BAR_H }]}>
            {[...STACK_ORDER].reverse().map((c) =>
              r.minutes[c] > 0 ? (
                <View key={c} style={{ height: (r.minutes[c] / max) * BAR_H, backgroundColor: CLASS_COLOR[c], borderTopWidth: 1, borderColor: colors.background }} />
              ) : null,
            )}
          </View>
          <Text style={styles.tick}>{dayFmt.format(new Date(r.start))}</Text>
        </View>
      ))}
    </View>
  )
}

/** Thời gian theo lớp tư thế (model v4): cột chồng + phân bố cả kỳ. Chỉ có dữ liệu khi Desktop gửi `postureClassSeconds`. */
export function PostureClassCard() {
  const [view, setView] = useState<'day' | 'week'>('day')
  const q = useMyPostureClasses(DAYS[view], view)
  const d = q.data
  const shares = d ? classShares(d.totals).filter((r) => r.seconds > 0) : []
  const top = d ? topBadClass(d.totals) : null
  const coverage = d ? classCoverage(d) : 0

  return (
    <>
      <SectionTitle>Thời gian theo lớp tư thế</SectionTitle>
      <Segmented label="Cách xem lớp tư thế" options={[...VIEWS]} value={view} onChange={setView} />
      <Card>
        {q.isPending ? (
          <LoadingState />
        ) : q.error ? (
          <ErrorState message={`Không tải được phân bố lớp tư thế: ${q.error.message}`} onRetry={() => q.refetch()} />
        ) : !d || d.classSec <= 0 ? (
          <EmptyState title="Chưa có dữ liệu lớp tư thế." hint="Cần Desktop App bản mới (model v4) gửi kèm thời gian theo lớp." />
        ) : (
          <>
            <StackedBars points={d.points} bucket={d.bucket} />
            <View style={styles.legend}>
              {STACK_ORDER.map((c) => (
                <View key={c} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: CLASS_COLOR[c] }]} />
                  <Text style={text.caption}>{CLASS_LABEL[c]}</Text>
                </View>
              ))}
            </View>
            <Text style={text.bodyStrong}>
              Phân bố cả kỳ{top ? ` · xấu nhiều nhất: ${CLASS_LABEL[top]}` : ''}
            </Text>
            {shares.map((r) => (
              <View
                key={r.posture}
                accessible
                accessibilityLabel={`${CLASS_LABEL[r.posture]}: ${Math.round(r.share * 100)}%, ${formatMinutes(r.seconds / 60)}`}
                style={styles.shareRow}>
                <Text style={[text.caption, styles.shareName]} numberOfLines={1}>{CLASS_LABEL[r.posture]}</Text>
                <View style={styles.shareTrack}>
                  <View style={[styles.shareFill, { width: `${Math.max(r.share * 100, 1)}%`, backgroundColor: CLASS_COLOR[r.posture] }]} />
                </View>
                <Text style={[text.caption, styles.shareValue]}>{Math.round(r.share * 100)}%</Text>
              </View>
            ))}
            {coverage < 0.95 ? (
              <Text style={text.caption}>
                Lớp tư thế có cho {Math.round(coverage * 100)}% thời gian có mặt; phần còn lại đến từ Desktop App hoặc model cũ chưa gửi lớp.
              </Text>
            ) : null}
          </>
        )}
      </Card>
    </>
  )
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  col: { flex: 1, alignItems: 'center', gap: space.xs },
  stack: { width: '100%', justifyContent: 'flex-end', borderRadius: 3, overflow: 'hidden' },
  tick: { fontSize: 10, color: colors.mutedForeground },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2, borderWidth: 1, borderColor: colors.border },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shareName: { width: 120 },
  shareTrack: { flex: 1, height: 10, borderRadius: radius.control, backgroundColor: colors.muted, overflow: 'hidden' },
  shareFill: { height: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control },
  shareValue: { width: 36, textAlign: 'right' },
})
