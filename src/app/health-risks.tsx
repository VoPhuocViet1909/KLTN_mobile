import { useRouter } from 'expo-router'
import { ChevronLeft, ExternalLink, ShieldAlert } from 'lucide-react-native'
import { useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMyHealthRisks, type HealthRisk, type Indicator, type Period } from '@/api/insights'
import { useTopInset } from '@/components/topInset'
import { Card, ErrorState, LoadingState, Segmented } from '@/components/ui'
import {
  barPercent, citation, DISCLAIMER, EVIDENCE_LABEL, formatIndicator, formatThreshold, LEVEL_LABEL, noteLabel, sortRisks,
  sourceHref,
} from '@/lib/healthRisk'
import { formatDateTime } from '@/lib/time'
import { colors, radius, space, text } from '@/theme/tokens'

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
]

/** Chi tiết nguy cơ sức khỏe (giống trang web): mức, chỉ số, giải thích, lời khuyên, nguồn. */
export default function HealthRisksScreen() {
  const router = useRouter()
  const topInset = useTopInset()
  const insets = useSafeAreaInsets()
  const [period, setPeriod] = useState<Period>('7d')
  const q = useMyHealthRisks(period)
  const [refreshing, setRefreshing] = useState(false)
  const data = q.data
  const note = noteLabel(data?.explanationNote ?? null)

  async function refresh() {
    setRefreshing(true)
    try {
      await q.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: topInset + space.sm, paddingBottom: insets.bottom + space.xxl }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.back}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text style={[text.body, { color: colors.primary }]}>Hôm nay</Text>
      </Pressable>
      <Text accessibilityRole="header" style={text.title}>Nguy cơ sức khỏe</Text>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} label="Khoảng thời gian" />

      <View accessibilityRole="summary" style={styles.disclaimer}>
        <ShieldAlert size={18} color={colors.primary} />
        <Text style={[text.caption, styles.flex]}>
          <Text style={text.bodyStrong}>{data?.disclaimer ?? DISCLAIMER}</Text> Mức nguy cơ do luật tính từ chỉ số tư thế và
          bảng tri thức có nguồn; hệ thống không dự đoán bệnh của riêng bạn.
        </Text>
      </View>

      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={`Chưa tải được cảnh báo nguy cơ: ${q.error.message}`} onRetry={() => q.refetch()} />
      ) : data ? (
        <>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={text.section}>Tóm tắt</Text>
              <Text style={[text.caption, styles.pill]}>
                {data.explanationSource === 'gemini' ? 'Lời giải thích do AI viết' : 'Câu mẫu soạn sẵn'}
              </Text>
            </View>
            <Text style={text.body}>{data.summary}</Text>
            {note && data.status === 'OK' ? <Text style={text.caption}>{note}</Text> : null}
            <Text style={text.caption}>
              Bảng tri thức {data.kbVersion} · cập nhật {formatDateTime(data.generatedAt)}
            </Text>
          </Card>
          {data.status === 'INSUFFICIENT_DATA' ? (
            <Card>
              <Text style={text.caption}>
                Chưa đủ dữ liệu để đánh giá. Hãy mở Desktop App khi làm việc; khi đủ thời gian có mặt trong kỳ, các nguy cơ sẽ hiện ở đây.
              </Text>
            </Card>
          ) : (
            sortRisks(data.risks).map((r) => <RiskCard key={r.kbId} risk={r} />)
          )}
        </>
      ) : null}
    </ScrollView>
  )
}

function IndicatorRow({ indicator }: { indicator: Indicator }) {
  const percent = barPercent(indicator)
  const medium = formatThreshold(indicator.key, indicator.mediumGte)
  const high = formatThreshold(indicator.key, indicator.highGte)
  return (
    <View
      accessible
      accessibilityLabel={`${indicator.label}: ${formatIndicator(indicator.key, indicator.value)}`}
      style={styles.indicator}>
      <View style={styles.rowBetween}>
        <Text style={[text.body, styles.flex]}>{indicator.label}</Text>
        <Text style={[text.bodyStrong, { fontVariant: ['tabular-nums'] }]}>{formatIndicator(indicator.key, indicator.value)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={text.caption}>
        {[medium && `Mức vừa từ ${medium}`, high && `mức cao từ ${high}`].filter(Boolean).join(', ')}
      </Text>
    </View>
  )
}

function RiskCard({ risk }: { risk: HealthRisk }) {
  const insufficient = risk.level === 'INSUFFICIENT_DATA'
  return (
    <Card>
      <Text accessibilityRole="header" style={text.section}>{risk.risk.vi}</Text>
      <Text style={text.caption}>{risk.risk.en} · {risk.factorLabel}</Text>
      <View style={styles.badges}>
        <Text style={[text.caption, styles.pill, risk.level === 'HIGH' && styles.pillBad]}>Mức: {LEVEL_LABEL[risk.level]}</Text>
        <Text style={[text.caption, styles.pill]}>Bằng chứng: {EVIDENCE_LABEL[risk.evidence]}</Text>
      </View>
      {risk.explanation ? <Text style={text.body}>{risk.explanation}</Text> : null}
      {!insufficient && risk.indicators.length > 0 ? (
        <View style={styles.block}>
          <Text style={text.bodyStrong}>Chỉ số đóng góp</Text>
          {risk.indicators.map((i) => <IndicatorRow key={i.key} indicator={i} />)}
          <Text style={text.caption}>
            Ngưỡng do hệ thống đặt để phân mức (không phải ngưỡng lâm sàng).
            {risk.cappedByEvidence ? ' Mức tối đa bị giới hạn vì bằng chứng yếu.' : ''}
          </Text>
        </View>
      ) : null}
      {!insufficient && risk.advice.length > 0 ? (
        <View style={styles.block}>
          <Text style={text.bodyStrong}>Lời khuyên</Text>
          {risk.advice.map((a) => <Text key={a} style={text.body}>• {a}</Text>)}
        </View>
      ) : null}
      <View style={styles.block}>
        <Text style={text.bodyStrong}>Nguồn</Text>
        {risk.sources.map((s) => {
          const href = sourceHref(s)
          return (
            <View key={s.doi ?? s.url ?? s.title} style={styles.source}>
              {href ? (
                <Pressable accessibilityRole="link" accessibilityLabel={`${citation(s)} (mở trình duyệt)`} onPress={() => void Linking.openURL(href)}>
                  <Text style={[text.caption, { color: colors.primary }]}>
                    {citation(s)} <ExternalLink size={12} color={colors.primary} />
                  </Text>
                </Pressable>
              ) : (
                <Text style={text.caption}>{citation(s)}</Text>
              )}
              <Text style={text.caption}>{s.claim}</Text>
            </View>
          )
        })}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  flex: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  disclaimer: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', padding: space.md, borderRadius: radius.control,
    backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.border,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  pillBad: { color: colors.destructive, borderColor: colors.destructive },
  block: { gap: space.sm },
  indicator: { gap: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  source: { gap: 2, marginBottom: space.xs },
})
