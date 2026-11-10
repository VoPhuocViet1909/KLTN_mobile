import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { HeatmapCell } from '@/api/stats'
import { colors, space, text } from '@/theme/tokens'
import { hourRange, SCORE_STEPS, stepFor, WEEKDAY_LABEL, WEEKDAY_SHORT } from './heatmapScale'

const CELL = 28
const GAP = 3

/** Lưới thứ × giờ (giờ 6–22, mở rộng nếu có dữ liệu ngoài khoảng). Chạm một ô để đọc điểm; ô không dữ liệu chỉ có viền xám. */
export function HabitHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const [picked, setPicked] = useState<HeatmapCell | null>(null)
  const withData = cells.filter((c) => c.meanScore !== null)
  const firstHour = Math.min(6, ...withData.map((c) => c.hour))
  const lastHour = Math.max(22, ...withData.map((c) => c.hour))
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)
  const byKey = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c]))

  return (
    <View style={{ gap: space.md }}>
      <Text style={[text.body, styles.reading]} accessibilityLiveRegion="polite">
        {picked
          ? `${WEEKDAY_LABEL[picked.weekday]}, ${hourRange(picked.hour)} – ${picked.meanScore === null ? 'không có dữ liệu' : `điểm tư thế ${Math.round(picked.meanScore)}`}`
          : 'Chạm một ô để xem điểm.'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ gap: GAP }}>
          <View style={styles.row}>
            <View style={styles.dayCol} />
            {hours.map((h) => (
              <Text key={h} style={[text.caption, styles.hourLabel]}>
                {h % 2 === 0 ? h : ''}
              </Text>
            ))}
          </View>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <View key={d} style={styles.row}>
              <Text style={[text.caption, styles.dayCol]}>{WEEKDAY_SHORT[d]}</Text>
              {hours.map((h) => {
                const cell = byKey.get(`${d}-${h}`) ?? { weekday: d, hour: h, meanScore: null }
                const s = cell.meanScore
                const on = picked?.weekday === d && picked.hour === h
                return (
                  <Pressable
                    key={h}
                    onPress={() => setPicked(cell)}
                    accessibilityLabel={`${WEEKDAY_LABEL[d]}, ${hourRange(h)}: ${s === null ? 'không có dữ liệu' : Math.round(s)}`}
                    style={[styles.cell, s === null ? styles.empty : { backgroundColor: stepFor(s).color }, on && styles.picked]}
                  />
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <Text style={text.caption}>Điểm tư thế:</Text>
        {SCORE_STEPS.map((s) => (
          <View key={s.min} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={text.caption}>{s.label}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.empty]} />
          <Text style={text.caption}>không có dữ liệu</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  reading: { minHeight: 44 },
  row: { flexDirection: 'row', gap: GAP, alignItems: 'center' },
  dayCol: { width: 28 },
  hourLabel: { width: CELL, textAlign: 'center' },
  cell: { width: CELL, height: CELL, borderRadius: 4 },
  empty: { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border },
  picked: { borderWidth: 2, borderColor: colors.foreground },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
})
