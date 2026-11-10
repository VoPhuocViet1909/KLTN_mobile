import { useQueryClient } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react-native'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api/client'
import { useServerOffline } from '@/lib/connectivity'
import { reconnectIfNeeded } from '@/realtime/socket'
import { colors, fonts, space } from '@/theme/tokens'

const RETRY_MS = 15_000 // như Desktop App: khi mất mạng, hỏi /health mỗi 15 giây

/**
 * Banner "Mất kết nối máy chủ" khi gọi API bị lỗi mạng. Tự hỏi /health mỗi 15 giây; có phản hồi thì tắt banner,
 * tải lại dữ liệu và nối lại Socket.IO.
 */
export function ConnectionBanner() {
  const offline = useServerOffline()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  async function check() {
    try {
      await api.get('/health', { timeout: 5_000 }) // interceptor tự báo "đã có phản hồi"
      void queryClient.invalidateQueries()
      reconnectIfNeeded()
    } catch {
      /* vẫn mất kết nối: interceptor giữ banner */
    }
  }

  useEffect(() => {
    if (!offline) return
    const id = setInterval(check, RETRY_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline])

  if (!offline) return null
  return (
    <View style={[styles.banner, { paddingTop: insets.top + space.sm }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <WifiOff size={18} color={colors.foreground} />
      <View style={styles.texts}>
        <Text style={styles.title}>Mất kết nối máy chủ</Text>
        <Text style={styles.sub}>Đang tự thử lại. Dữ liệu hiển thị có thể đã cũ.</Text>
      </View>
      <Pressable onPress={check} accessibilityRole="button" accessibilityLabel="Thử kết nối lại" style={styles.retry}>
        <Text style={styles.retryLabel}>Thử lại</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: colors.muted,
    borderBottomColor: colors.status.offline,
    borderBottomWidth: 2,
  },
  texts: { flex: 1 },
  title: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  retry: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  retryLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
})
