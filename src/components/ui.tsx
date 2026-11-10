import type { LucideIcon } from 'lucide-react-native'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native'
import { colors, fonts, radius, space, text } from '@/theme/tokens'

/** Panel trắng, viền mảnh, không đổ bóng (design system mục 2). */
export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  )
}

/** Cặp nhãn nhỏ + giá trị, dùng trong lưới số liệu. */
export function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
      <Text style={text.caption}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
      {hint ? <Text style={text.caption}>{hint}</Text> : null}
    </View>
  )
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'outline'
}) {
  const inactive = disabled || loading
  const primary = variant === 'primary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonOutline,
        inactive && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
      ]}>
      {loading ? <ActivityIndicator color={primary ? colors.primaryForeground : colors.primary} /> : null}
      <Text style={[styles.buttonLabel, { color: primary ? colors.primaryForeground : colors.primary }]}>{label}</Text>
    </Pressable>
  )
}

/** Trạng thái đang tải. */
export function LoadingState({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <Text style={text.caption}>{label}</Text>
    </View>
  )
}

/** Trạng thái rỗng: nói rõ vì sao trống và việc cần làm. */
export function EmptyState({ icon: Icon, title, hint }: { icon?: LucideIcon; title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      {Icon ? <Icon size={28} color={colors.mutedForeground} /> : null}
      <Text style={[text.bodyStrong, styles.centerText]}>{title}</Text>
      {hint ? <Text style={[text.caption, styles.centerText]}>{hint}</Text> : null}
    </View>
  )
}

/** Trạng thái lỗi kèm nút thử lại. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text style={[text.bodyStrong, styles.centerText, { color: colors.destructive }]}>{message}</Text>
      {onRetry ? <Button label="Thử lại" variant="outline" onPress={onRetry} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.panel,
    padding: space.lg,
    gap: space.md,
  },
  sectionTitle: { ...text.section },
  fact: { flexGrow: 1, flexBasis: '45%', gap: 2 },
  factValue: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32, color: colors.foreground },
  button: {
    minHeight: 48, // chạm tối thiểu 44-48px
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { backgroundColor: colors.background, borderColor: colors.input, borderWidth: 1 },
  buttonLabel: { fontFamily: fonts.medium, fontSize: 14 },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.lg },
  centerText: { textAlign: 'center' },
})
