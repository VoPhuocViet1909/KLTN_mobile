import { useCallback, useState, type ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, space, text } from '@/theme/tokens'

/**
 * Khung màn hình: vùng an toàn, tiêu đề, cuộn được và kéo xuống để làm mới.
 * `onRefresh` trả Promise; xoay vòng tải đến khi xong.
 */
export function Screen({
  title,
  subtitle,
  onRefresh,
  children,
}: {
  title: string
  subtitle?: string
  onRefresh?: () => Promise<unknown>
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh])

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined
      }
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={text.title}>
          {title}
        </Text>
        {subtitle ? <Text style={text.caption}>{subtitle}</Text> : null}
      </View>
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.lg },
  header: { gap: space.xs },
})
