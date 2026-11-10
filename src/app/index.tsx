import { Text, View } from 'react-native'
import { colors } from '@/theme/tokens'

// Màn tạm của commit khởi tạo; được thay bằng đăng nhập + tab ở nhánh feat/auth-overview.
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
      <Text>KLTN Tư thế</Text>
    </View>
  )
}
