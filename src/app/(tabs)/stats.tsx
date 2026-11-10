import { useState } from 'react'
import { Text, View } from 'react-native'
import { useMyHeatmap, useMyTimeseries, type HeatmapCell } from '@/api/stats'
import { BadMinutesBars, DayDetail, fillDays, ScoreLine } from '@/components/charts/ScoreTrend'
import { HabitHeatmap } from '@/components/charts/HabitHeatmap'
import { hourRange, WEEKDAY_LABEL } from '@/components/charts/heatmapScale'
import { Screen } from '@/components/Screen'
import { Card, EmptyState, ErrorState, LoadingState, Segmented, SectionTitle } from '@/components/ui'
import { space, text } from '@/theme/tokens'

const DAY_RANGES = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
]
const WEEK_RANGES = [
  { value: 1, label: '1 tuần' },
  { value: 4, label: '4 tuần' },
  { value: 12, label: '12 tuần' },
]

export default function StatsScreen() {
  const [days, setDays] = useState(7)
  const [weeks, setWeeks] = useState(4)
  const [picked, setPicked] = useState<number | null>(null)
  const series = useMyTimeseries(days, 'day')
  const heatmap = useMyHeatmap(weeks)

  const points = series.data ? fillDays(series.data, days) : []
  const hasSeries = points.some((p) => p.presenceMinutes > 0)
  const cells = heatmap.data ?? []
  const scored = cells.filter((c): c is HeatmapCell & { meanScore: number } => c.meanScore !== null)
  const worst = [...scored].sort((a, b) => a.meanScore - b.meanScore).slice(0, 3)

  return (
    <Screen
      title="Thống kê"
      subtitle="Xu hướng và thói quen ngồi của bạn."
      onRefresh={() => Promise.all([series.refetch(), heatmap.refetch()])}>
      <Segmented
        label="Khoảng thời gian xu hướng"
        options={DAY_RANGES}
        value={days}
        onChange={(d) => {
          setDays(d)
          setPicked(null)
        }}
      />

      <Card>
        <SectionTitle>Điểm tư thế theo ngày</SectionTitle>
        {series.isPending ? (
          <LoadingState />
        ) : series.error ? (
          <ErrorState message={`Không tải được biểu đồ: ${series.error.message}`} onRetry={() => series.refetch()} />
        ) : !hasSeries ? (
          <EmptyState title="Chưa có dữ liệu trong khoảng này." hint="Mở Desktop App khi làm việc để bắt đầu ghi lại." />
        ) : (
          <>
            <ScoreLine points={points} selected={picked} onSelect={setPicked} />
            <DayDetail point={picked === null ? null : (points[picked] ?? null)} />
          </>
        )}
      </Card>

      {hasSeries && (
        <Card>
          <SectionTitle>Phút ngồi sai mỗi ngày</SectionTitle>
          <BadMinutesBars points={points} onSelect={setPicked} />
        </Card>
      )}

      <SectionTitle>Thói quen</SectionTitle>
      <Segmented label="Khoảng thời gian thói quen" options={WEEK_RANGES} value={weeks} onChange={setWeeks} />
      <Card>
        {heatmap.isPending ? (
          <LoadingState />
        ) : heatmap.error ? (
          <ErrorState message={`Không tải được bản đồ thói quen: ${heatmap.error.message}`} onRetry={() => heatmap.refetch()} />
        ) : scored.length === 0 ? (
          <EmptyState title={`Chưa có dữ liệu trong ${weeks} tuần qua.`} hint="Mở Desktop App khi làm việc để bắt đầu ghi lại." />
        ) : (
          <HabitHeatmap cells={cells} />
        )}
      </Card>

      {worst.length > 0 && (
        <Card>
          <SectionTitle>Khung giờ ngồi kém nhất</SectionTitle>
          {worst.map((c) => (
            <View key={`${c.weekday}-${c.hour}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <Text style={[text.body, { flexShrink: 1 }]}>
                {WEEKDAY_LABEL[c.weekday]}, {hourRange(c.hour)}
              </Text>
              <Text style={text.bodyStrong}>{Math.round(c.meanScore)}</Text>
            </View>
          ))}
          <Text style={text.caption}>Thử đứng dậy vận động hoặc chỉnh lại ghế trước những khung giờ này.</Text>
        </Card>
      )}
    </Screen>
  )
}
