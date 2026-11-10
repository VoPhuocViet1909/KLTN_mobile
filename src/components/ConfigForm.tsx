import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import type { ConfigValues } from '@/api/config'
import { buildBody, changedKeys, clearedBody, draftFromServer, stableKey, validateDraft, type Draft } from '@/lib/configForm'
import { CONFIG_FIELDS, FIELD_BY_KEY, GROUPS, PRESERVED_KEYS, type ConfigField } from '@/lib/configFields'
import { toApiError } from '@/lib/errors'
import { colors, fonts, radius, space, text } from '@/theme/tokens'
import { Button, Card, ErrorState, LoadingState, SectionTitle } from './ui'

interface Props {
  /** Chỉ các khóa cá nhân (`details.personal`), không dùng cấu hình đã gộp. */
  personal: ConfigValues | undefined
  /** Khóa tổ chức đặt, để hiện "Theo tổ chức" khi kế thừa. */
  organization: ConfigValues | undefined
  error: Error | null
  isPending: boolean
  onRetry: () => void
  save: { mutate: (body: ConfigValues, o: { onSuccess: () => void; onError: (e: unknown) => void }) => void; isPending: boolean }
}

/**
 * Form cấu hình cá nhân – cùng quy tắc với web (ConfigEditor): ô "Mặc định" (không gửi) hoặc "Tùy chỉnh" (gửi);
 * PUT thay toàn bộ phần cá nhân nên luôn gửi lại khóa hiệu chỉnh camera; nhận `config` realtime khi đang sửa thì
 * báo xung đột và KHÔNG ghi đè bản nháp, chặn lưu bản cũ cho tới khi bấm "Dùng giá trị mới".
 */
export function ConfigForm({ personal, organization, error, isPending, onRetry, save }: Props) {
  const baseline = useMemo(() => draftFromServer(personal), [personal])
  const serverKey = useMemo(() => stableKey(personal) + stableKey(organization), [personal, organization])

  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftBase, setDraftBase] = useState('')
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const current = draft ?? baseline
  const changes = draft ? changedKeys(draft, baseline) : []
  const dirty = changes.length > 0
  const conflict = draft !== null && draftBase !== serverKey
  const clientErrors = useMemo(() => validateDraft(current, organization), [current, organization])
  const errors = { ...serverErrors, ...clientErrors }
  const hasErrors = Object.keys(clientErrors).length > 0
  const hasCustom = Object.keys(current).length > 0 || Object.keys(baseline).length > 0

  function begin() {
    if (draft === null) setDraftBase(serverKey)
  }
  function edit(key: string, value: string | boolean) {
    begin()
    setDraft({ ...current, [key]: value })
    setServerErrors(({ [key]: _gone, ...rest }) => rest)
    setFormError(null)
    setSaved(null)
  }
  function resetField(key: string) {
    begin()
    const { [key]: _gone, ...rest } = current
    setDraft(rest)
    setServerErrors(({ [key]: _g, ...r }) => r)
    setFormError(null)
    setSaved(null)
  }
  function discard() {
    setDraft(null)
    setServerErrors({})
    setFormError(null)
  }

  function send(body: ConfigValues, done: string) {
    setFormError(null)
    save.mutate(body, {
      onSuccess: () => {
        discard()
        setSaved(done)
      },
      onError: (e) => {
        const err = toApiError(e)
        const mapped: Record<string, string> = {}
        let general: string | null = null
        if (err.code === 'VALIDATION_FAILED' && Object.keys(err.fieldErrors).length > 0) {
          for (const [field, message] of Object.entries(err.fieldErrors)) {
            const key = field.split('.').pop() ?? field
            if (key in FIELD_BY_KEY) mapped[key] = translateFieldError(FIELD_BY_KEY[key], message)
            else general = `${key}: ${message}`
          }
        } else {
          general = err.message
        }
        setServerErrors(mapped)
        setFormError(general ?? (Object.keys(mapped).length ? 'Máy chủ không nhận một số giá trị. Xem các ô báo lỗi.' : null))
      },
    })
  }

  function confirmClear() {
    Alert.alert(
      'Xóa mọi tùy chỉnh?',
      'Các tùy chỉnh sẽ quay về cấu hình tổ chức hoặc mặc định của ứng dụng. Cấu hình hiệu chỉnh camera được giữ nguyên.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        { text: 'Xóa mọi tùy chỉnh', style: 'destructive', onPress: () => send(clearedBody(personal, PRESERVED_KEYS), 'Đã xóa mọi tùy chỉnh') },
      ],
    )
  }

  if (isPending) return <LoadingState label="Đang tải cấu hình…" />
  if (error) return <ErrorState message={`Không tải được cấu hình: ${error.message}`} onRetry={onRetry} />

  return (
    <View style={{ gap: space.lg }}>
      <Text style={text.caption}>Áp dụng cho Desktop App trên mọi máy của bạn.</Text>

      {conflict && (
        <Card accessibilityRole="alert">
          <Text style={text.bodyStrong}>Cấu hình vừa thay đổi ở nơi khác</Text>
          <Text style={text.caption}>Các thay đổi chưa lưu của bạn chưa bị ghi đè. Lưu đang bị khóa để tránh ghi đè bản mới.</Text>
          <Button label="Dùng giá trị mới" variant="outline" onPress={discard} />
        </Card>
      )}

      {saved && !dirty ? <Text style={[text.bodyStrong, { color: colors.primary }]} accessibilityLiveRegion="polite">{saved}</Text> : null}

      {GROUPS.map((group) => {
        const fields = CONFIG_FIELDS.filter((f) => f.group === group.id)
        const isAdvanced = group.id === 'advanced'
        const issue = fields.some((f) => errors[f.key])
        const open = !isAdvanced || advancedOpen || issue
        return (
          <Card key={group.id}>
            {isAdvanced ? (
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setAdvancedOpen((v) => !v)} style={styles.groupHead}>
                <SectionTitle>{group.title}</SectionTitle>
                {open ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
              </Pressable>
            ) : (
              <SectionTitle>{group.title}</SectionTitle>
            )}
            {group.description ? <Text style={text.caption}>{group.description}</Text> : null}
            {open &&
              fields.map((f) => (
                <Field
                  key={f.key}
                  field={f}
                  value={current[f.key]}
                  inherited={organization?.[f.key]}
                  error={errors[f.key]}
                  onChange={(v) => edit(f.key, v)}
                  onReset={() => resetField(f.key)}
                />
              ))}
          </Card>
        )
      })}

      {dirty && (
        <Card>
          <Text style={text.bodyStrong} accessibilityLiveRegion="polite">
            Có {changes.length} thay đổi chưa lưu
          </Text>
          {hasErrors ? <Text style={styles.error}>Sửa các ô báo lỗi trước khi lưu.</Text> : null}
          {formError ? <Text style={styles.error}>Không lưu được: {formError}</Text> : null}
          <Button
            label="Lưu cấu hình"
            loading={save.isPending}
            disabled={hasErrors || conflict}
            onPress={() => send(buildBody(current, personal, PRESERVED_KEYS), 'Đã lưu cấu hình')}
          />
          <Button label="Hủy thay đổi" variant="outline" onPress={discard} disabled={save.isPending} />
        </Card>
      )}

      <Button label="Xóa mọi tùy chỉnh" variant="outline" disabled={!hasCustom || save.isPending || conflict} onPress={confirmClear} />
      {formError && !dirty ? <Text style={styles.error}>Không xóa được: {formError}</Text> : null}
    </View>
  )
}

function Field({
  field: f,
  value,
  inherited,
  error,
  onChange,
  onReset,
}: {
  field: ConfigField
  /** undefined = Mặc định */
  value: string | boolean | null | undefined
  inherited: ConfigValues[string] | undefined
  error: string | undefined
  onChange: (value: string | boolean) => void
  onReset: () => void
}) {
  const custom = value !== undefined
  const fallback = inherited === undefined ? f.default : inherited
  const displayed = custom ? value : fallback
  const sourceLabel = inherited === undefined ? 'Mặc định' : `Theo tổ chức: ${formatInherited(f, inherited)}`

  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={[text.bodyStrong, styles.flex]}>{f.label}</Text>
        {custom ? (
          <Pressable accessibilityRole="button" onPress={onReset} hitSlop={8} style={styles.resetBtn}>
            <Text style={styles.resetLabel}>{inherited === undefined ? 'Dùng mặc định' : 'Theo tổ chức'}</Text>
          </Pressable>
        ) : null}
      </View>
      {!custom ? <Text style={text.caption}>{sourceLabel}</Text> : null}

      {f.kind === 'boolean' ? (
        <View style={styles.switchRow}>
          <Switch
            value={Boolean(displayed)}
            onValueChange={onChange}
            accessibilityLabel={f.label}
            trackColor={{ true: colors.primary, false: colors.input }}
          />
          <Text style={custom ? text.body : text.caption}>{displayed ? 'Bật' : 'Tắt'}</Text>
        </View>
      ) : (
        <View style={styles.inputWrap}>
          <TextInput
            accessibilityLabel={f.label}
            style={[styles.input, !custom && { color: colors.mutedForeground }, !!error && { borderColor: colors.destructive }]}
            keyboardType={f.kind === 'integer' ? 'number-pad' : 'decimal-pad'}
            value={displayed === null || displayed === undefined ? '' : String(displayed)}
            placeholder={f.defaultText}
            placeholderTextColor={colors.mutedForeground}
            onChangeText={(t) => onChange(t.replace(',', '.'))}
          />
          {f.unit ? <Text style={styles.unit}>{f.unit}</Text> : null}
        </View>
      )}

      <Text style={text.caption}>{f.hint}</Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

/** Backend trả lỗi tiếng Anh (vd "must be between 1 and 120"): dịch theo min/max của trường; câu lạ thì giữ nguyên. */
export function translateFieldError(f: ConfigField, message: string) {
  const unit = f.unit ? ` ${f.unit}` : ''
  if (/between/i.test(message) && f.min !== undefined && f.max !== undefined) return `Phải từ ${f.min} đến ${f.max}${unit}.`
  if (/(greater|at least|minimum)/i.test(message) && f.min !== undefined) return `Không nhỏ hơn ${f.min}${unit}.`
  if (/(less|at most|maximum)/i.test(message) && f.max !== undefined) return `Không lớn hơn ${f.max}${unit}.`
  if (/integer/i.test(message)) return 'Phải là số nguyên.'
  if (/(number|numeric|valid)/i.test(message)) return 'Phải là một số hợp lệ.'
  return message
}

function formatInherited(f: ConfigField, v: ConfigValues[string]) {
  if (typeof v === 'boolean') return v ? 'Bật' : 'Tắt'
  if (v === null) return f.defaultText ?? 'Theo mô hình'
  return `${v}${f.unit ? ` ${f.unit}` : ''}`
}

const styles = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  field: { gap: space.xs, paddingTop: space.sm },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  flex: { flexShrink: 1 },
  resetBtn: { minHeight: 44, justifyContent: 'center' },
  resetLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  inputWrap: { justifyContent: 'center' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingRight: 64,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  unit: { position: 'absolute', right: space.md, ...text.caption },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.destructive },
})
