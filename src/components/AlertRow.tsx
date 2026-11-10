import { StyleSheet, Text, View } from 'react-native'
import type { AlertItem } from '@/api/alerts'
import { alertEndLabel, alertLabel, severityLabel } from '@/lib/labels'
import { formatDateTime, formatDuration } from '@/lib/time'
import { colors, space, text } from '@/theme/tokens'

/** Một lần cảnh báo (dùng ở Lịch sử cá nhân và chi tiết nhân viên). */
export function AlertRow({ a }: { a: AlertItem }) {
  return (
    <View
      style={styles.body}
      accessible
      accessibilityLabel={`${alertLabel(a.alertType)}, ${formatDateTime(a.startedAt)}, thời lượng ${formatDuration(a.durationSec)}, ${a.open ? 'đang diễn ra' : alertEndLabel(a.endReason)}`}>
      <View style={styles.top}>
        <Text style={[text.bodyStrong, styles.flex]}>{alertLabel(a.alertType)}</Text>
        <Text style={styles.pill}>{a.open ? 'Đang diễn ra' : severityLabel(a.severity)}</Text>
      </View>
      <Text style={text.caption}>{formatDateTime(a.startedAt)}</Text>
      <Text style={text.body}>
        Kéo dài {formatDuration(a.durationSec)}
        {a.repeatCount > 0 ? ` · nhắc lại ${a.repeatCount} lần` : ''}
      </Text>
      {!a.open && <Text style={text.caption}>{alertEndLabel(a.endReason)}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  flex: { flexShrink: 1 },
  pill: { ...text.caption, color: colors.foreground },
})
