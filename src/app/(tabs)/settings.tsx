import { LogOut } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/context'
import { Screen } from '@/components/Screen'
import { Button, Card, SectionTitle } from '@/components/ui'
import { roleLabel } from '@/lib/labels'
import { colors, space, text } from '@/theme/tokens'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const [busy, setBusy] = useState(false)

  function confirmLogout() {
    Alert.alert('Đăng xuất', 'Bạn sẽ cần đăng nhập lại để xem số liệu.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          await logout()
        },
      },
    ])
  }

  return (
    <Screen title="Cài đặt">
      <Card>
        <SectionTitle>Tài khoản</SectionTitle>
        <Row label="Tên" value={user?.name || '—'} />
        <Row label="Email" value={user?.email || '—'} />
        <Row label="Vai trò" value={roleLabel(user?.role)} />
      </Card>
      <Button label="Đăng xuất" variant="outline" onPress={confirmLogout} loading={busy} />
      <View style={styles.hint}>
        <LogOut size={14} color={colors.mutedForeground} />
        <Text style={text.caption}>Cấu hình cá nhân và thông báo sẽ có ở bản cập nhật sau.</Text>
      </View>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={text.caption}>{label}</Text>
      <Text style={[text.body, styles.value]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 2 },
  value: { flexShrink: 1 },
  hint: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
})
