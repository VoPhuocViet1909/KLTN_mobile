import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useServerOffline } from '@/lib/connectivity'

/**
 * Đệm trên của màn hình. Khi banner "Mất kết nối máy chủ" đang hiện, banner đã chiếm vùng tai thỏ/thanh trạng thái
 * nên màn hình không đệm thêm lần nữa.
 */
export function useTopInset() {
  const { top } = useSafeAreaInsets()
  return useServerOffline() ? 0 : top
}
