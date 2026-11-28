import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useCallback, useState, type ReactNode } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTopInset } from '@/components/topInset'
import { colors, space, text } from '@/theme/tokens'

/**
 * Khung màn hình: vùng an toàn, tiêu đề, cuộn được và kéo xuống để làm mới.
 * `onRefresh` trả Promise; xoay vòng tải đến khi xong.
 */
export function Screen({
  title,
  subtitle,
  onRefresh,
  back,
  children,
}: {
  title: string
  subtitle?: string
  onRefresh?: () => Promise<unknown>
  /** Có nhãn thì hiện nút quay lại ở đầu màn (cho màn con ngoài thanh tab). */
  back?: string
  children: ReactNode
}) {
  const router = useRouter()
  const topInset = useTopInset()
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
      contentContainerStyle={[styles.content, { paddingTop: topInset + space.lg }]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined
      }
      keyboardShouldPersistTaps="handled">
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}>
          <ChevronLeft size={20} color={colors.primary} />
          <Text style={[text.body, { color: colors.primary }]}>{back}</Text>
        </Pressable>
      ) : null}
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
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
})
