import { useRouter } from 'expo-router'
import { ChevronRight, ShieldAlert } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useMyHealthRisks, type HealthRisk } from '@/api/insights'
import { Card, SectionTitle } from '@/components/ui'
import { DISCLAIMER, EVIDENCE_LABEL, LEVEL_LABEL, sortRisks } from '@/lib/healthRisk'
import { colors, space, text } from '@/theme/tokens'

/** Nguy cơ cao nhất trong 7 ngày; không có nguy cơ vừa/cao thì nói rõ. Bấm để mở màn chi tiết. */
export function HealthRiskCard() {
  const router = useRouter()
  const q = useMyHealthRisks('7d')
  const top: HealthRisk | undefined = q.data ? sortRisks(q.data.risks)[0] : undefined
  const elevated = top && (top.level === 'HIGH' || top.level === 'MEDIUM')

  let body: string
  if (q.isPending) body = 'Đang tải…'
  else if (q.error) body = 'Chưa tải được cảnh báo nguy cơ. Chạm để thử lại.'
  else if (q.data?.status === 'INSUFFICIENT_DATA') body = 'Chưa đủ dữ liệu 7 ngày để đánh giá. Hãy dùng Desktop App khi làm việc.'
  else if (elevated) body = top.risk.vi
  else body = 'Chưa có nguy cơ nào vượt ngưỡng trong 7 ngày qua.'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Nguy cơ sức khỏe. ${body}. Chạm để xem chi tiết`}
      onPress={() => router.push('/health-risks')}>
      <Card>
        <View style={styles.head}>
          <SectionTitle>Nguy cơ sức khỏe</SectionTitle>
          <ChevronRight size={18} color={colors.mutedForeground} />
        </View>
        <View style={styles.row}>
          <ShieldAlert size={20} color={top?.level === 'HIGH' ? colors.destructive : colors.primary} />
          <View style={styles.texts}>
            <Text style={text.bodyStrong}>{body}</Text>
            {elevated ? (
              <Text style={text.caption}>
                Mức {LEVEL_LABEL[top.level].toLowerCase()} · bằng chứng {EVIDENCE_LABEL[top.evidence]}
              </Text>
            ) : null}
            {elevated && top.postureClasses?.top ? (
              <Text style={text.caption}>
                Tư thế đóng góp nhiều nhất: {top.postureClasses.top.label} ({Math.round(top.postureClasses.top.share * 100)}%)
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={text.caption}>{DISCLAIMER}</Text>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  texts: { flex: 1, gap: 2 },
})
