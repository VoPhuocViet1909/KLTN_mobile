import { StyleSheet, Text, View } from 'react-native'
import { STATE_META } from '@/lib/labels'
import type { DeviceState } from '@/realtime/socket'
import { colors, fonts, space } from '@/theme/tokens'

/**
 * Trạng thái tư thế. Màu KHÔNG đứng một mình: luôn có icon + chữ.
 * Màu chỉ tô icon; chữ dùng màu chữ chính để dễ đọc (design system mục 3).
 */
export function StatusBadge({ state, size = 'md' }: { state: DeviceState; size?: 'md' | 'lg' }) {
  const meta = STATE_META[state]
  const Icon = meta.icon
  const big = size === 'lg'
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={`Trạng thái: ${meta.label}`}>
      <Icon size={big ? 32 : 18} color={meta.color} strokeWidth={2.25} />
      <Text style={[styles.label, big && styles.labelLg]}>{meta.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.foreground },
  labelLg: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32 },
})
