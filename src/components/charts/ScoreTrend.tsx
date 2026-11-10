import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { BarChart } from 'react-native-gifted-charts'
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg'
import { sumAlerts, type Bucket } from '@/api/stats'
import { VN_TZ, vnDayStarts } from '@/lib/time'
import { colors, space, text } from '@/theme/tokens'

const dayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, day: '2-digit', month: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, weekday: 'long', day: '2-digit', month: '2-digit' })

export interface Point {
  start: string
  score: number | null
  badMinutes: number | null
  presenceMinutes: number
  alerts: number
}

/** Backend chỉ trả ngày có dữ liệu: điền đủ mọi ngày, ngày trống là null (khoảng hở, không điểm giả). */
export function fillDays(data: Bucket[], days: number): Point[] {
  const byDay = new Map(data.map((b) => [new Date(b.start).toISOString(), b]))
  return vnDayStarts(days).map((start) => {
    const b = byDay.get(start)
    return {
      start,
      score: b?.meanScore == null ? null : Math.round(b.meanScore),
      badMinutes: b ? Math.round(b.badMinutes) : null,
      presenceMinutes: Math.round(b?.presenceMinutes ?? 0),
      alerts: b ? sumAlerts(b.alerts) : 0,
    }
  })
}

const H = 180
const PAD = { l: 30, r: 8, t: 10, b: 22 }
const TICKS = [0, 25, 50, 75, 100]

/** Đường điểm tư thế 0–100. Tự vẽ bằng SVG vì cần ngắt đường ở ngày không có dữ liệu. Chạm một ngày để xem chi tiết. */
export function ScoreLine({ points, selected, onSelect }: { points: Point[]; selected: number | null; onSelect: (i: number) => void }) {
  const [width, setWidth] = useState(0)
  const w = width - PAD.l - PAD.r
  const x = (i: number) => PAD.l + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w)
  const y = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b)
  // tách thành các đoạn liên tục
  const segments: { i: number; v: number }[][] = []
  points.forEach((p, i) => {
    if (p.score === null) {
      segments.push([])
    } else {
      if (!segments.length) segments.push([])
      segments[segments.length - 1].push({ i, v: p.score })
    }
  })
  const step = Math.max(1, Math.ceil(points.length / 6))
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel="Biểu đồ điểm tư thế theo ngày">
      {width > 0 && (
        <Svg width={width} height={H}>
          {TICKS.map((t) => (
            <Line key={`g${t}`} x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
          ))}
          {TICKS.map((t) => (
            <SvgText key={`l${t}`} x={PAD.l - 6} y={y(t) + 4} fontSize={11} fill={colors.mutedForeground} textAnchor="end">
              {t}
            </SvgText>
          ))}
          {points.map((p, i) =>
            i % step === 0 ? (
              <SvgText key={`x${i}`} x={x(i)} y={H - 6} fontSize={11} fill={colors.mutedForeground} textAnchor="middle">
                {dayFmt.format(new Date(p.start))}
              </SvgText>
            ) : null,
          )}
          {segments.map((seg, k) =>
            seg.length > 1 ? (
              <Polyline key={k} points={seg.map((s) => `${x(s.i)},${y(s.v)}`).join(' ')} fill="none" stroke={colors.chart[0]} strokeWidth={2} />
            ) : null,
          )}
          {points.map((p, i) =>
            p.score === null ? null : (
              <Circle key={`d${i}`} cx={x(i)} cy={y(p.score)} r={selected === i ? 6 : 4} fill={colors.chart[0]} stroke={colors.background} strokeWidth={2} />
            ),
          )}
          {/* vùng chạm rộng cho mỗi ngày */}
          {points.map((_, i) => (
            <Line
              key={`t${i}`}
              x1={x(i)}
              x2={x(i)}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="transparent"
              strokeWidth={Math.max(16, w / points.length)}
              onPress={() => onSelect(i)}
            />
          ))}
        </Svg>
      )}
    </View>
  )
}

/** Cột phút ngồi sai mỗi ngày (react-native-gifted-charts). Ngày không dữ liệu để cột rỗng. */
export function BadMinutesBars({ points, onSelect }: { points: Point[]; onSelect: (i: number) => void }) {
  const [width, setWidth] = useState(0)
  const n = points.length
  const step = Math.max(1, Math.ceil(n / 6))
  const spacing = 4
  const barWidth = width > 0 ? Math.max(4, Math.floor((width - 44 - spacing * n) / n)) : 8
  const max = Math.max(10, ...points.map((p) => p.badMinutes ?? 0))
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel="Biểu đồ phút ngồi sai theo ngày">
      {width > 0 && (
        <BarChart
          data={points.map((p, i) => ({
            value: p.badMinutes ?? 0,
            label: i % step === 0 ? dayFmt.format(new Date(p.start)) : '',
            frontColor: colors.chart[0],
            onPress: () => onSelect(i),
          }))}
          width={width - 44}
          height={140}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={spacing}
          maxValue={max}
          noOfSections={4}
          barBorderTopLeftRadius={3}
          barBorderTopRightRadius={3}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.border}
          rulesColor={colors.border}
          yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 11 }}
          xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
          disableScroll
          isAnimated={false}
        />
      )}
    </View>
  )
}

export function DayDetail({ point }: { point: Point | null }) {
  if (!point) return <Text style={text.caption}>Chạm vào một ngày trên biểu đồ để xem chi tiết.</Text>
  return (
    <View style={styles.detail} accessibilityLiveRegion="polite">
      <Text style={text.bodyStrong}>{weekdayFmt.format(new Date(point.start))}</Text>
      {point.presenceMinutes === 0 ? (
        <Text style={text.caption}>Không có dữ liệu</Text>
      ) : (
        <Text style={text.caption}>
          Điểm {point.score ?? '—'} · ngồi sai {point.badMinutes} phút · có mặt {point.presenceMinutes} phút · {point.alerts} cảnh báo
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({ detail: { gap: 2, minHeight: 40, paddingTop: space.xs } })
