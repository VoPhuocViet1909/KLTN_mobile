import { useState } from 'react'
import { Button, StyleSheet, Switch, Text, View } from 'react-native'
import { useNotificationSettings } from '@/notifications/NotificationProvider'
import { colors, space, text } from '@/theme/tokens'
import { Card, SectionTitle } from './ui'

/** Công tắc thông báo cục bộ. Tùy chọn của máy này, không gửi lên config-service. */
export function NotificationSettings() {
  const { enabled, permission, ready, setEnabled, debug, sendTest } = useNotificationSettings()
  const [testResult, setTestResult] = useState('')
  const [busy, setBusy] = useState(false)

  async function toggle(on: boolean) {
    setBusy(true)
    try {
      await setEnabled(on)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <SectionTitle>Thông báo trên điện thoại</SectionTitle>
      <View style={styles.row}>
        <View style={styles.texts}>
          <Text style={text.bodyStrong} nativeID="notify-label">
            Thông báo khi ngồi sai
          </Text>
          <Text style={text.caption}>
            {permission === 'blocked'
              ? 'Thông báo đang bị tắt trong Cài đặt của điện thoại.'
              : 'Hiện thông báo khi bạn bắt đầu ngồi sai (tối đa 1 lần mỗi loại cảnh báo trong 5 phút).'}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={!ready || busy}
          accessibilityLabel="Thông báo khi ngồi sai"
          accessibilityLabelledBy="notify-label"
          trackColor={{ false: colors.input, true: colors.primary }}
        />
      </View>
      <Text style={text.caption}>
        Chỉ nhận được khi ứng dụng đang mở hoặc vừa chuyển sang nền. Tắt hẳn ứng dụng thì không nhận được thông báo.
      </Text>
      {__DEV__ ? (
        <View style={styles.debug}>
          <Text style={text.bodyStrong}>Chẩn đoán (tạm, chỉ khi dev)</Text>
          <Text style={text.caption}>Quyền hệ điều hành: {permission}</Text>
          <Text style={text.caption}>Công tắc: {enabled ? 'BẬT' : 'TẮT'}{ready ? '' : ' (đang tải)'}</Text>
          <Text style={text.caption}>Số gói status đã nhận: {debug.received}</Text>
          <Text style={text.caption}>Gói gần nhất: {debug.lastStatus}</Text>
          <Text style={text.caption}>Quyết định: {debug.lastDecision}</Text>
          <Text style={text.caption}>Lỗi hiện thông báo: {debug.lastError}</Text>
          <Button title="Gửi thông báo thử" onPress={() => void sendTest().then(setTestResult)} />
          {testResult ? <Text style={text.caption}>Kết quả: {testResult}</Text> : null}
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  texts: { flex: 1, gap: 2 },
  debug: { gap: 2, borderTopWidth: 1, borderTopColor: colors.input, paddingTop: space.sm },
})
