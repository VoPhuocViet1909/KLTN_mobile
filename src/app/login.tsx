import { Eye, EyeOff, TriangleAlert } from 'lucide-react-native'
import { useRef, useState, type ComponentRef } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_URL_MISSING } from '@/api/env'
import { useAuth } from '@/auth/context'
import { Button } from '@/components/ui'
import { MSG_NETWORK, toApiError } from '@/lib/errors'
import { colors, fonts, radius, space, text } from '@/theme/tokens'

/** Câu lỗi tiếng Việt cho màn đăng nhập. Rẽ nhánh theo `code`, không theo `message`. */
function loginMessage(err: unknown) {
  const e = toApiError(err)
  if (e.status === 0) return `${MSG_NETWORK}. Kiểm tra Wi-Fi và địa chỉ máy chủ trong file .env.`
  if (e.code === 'AUTH_INVALID_CREDENTIALS') return 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.'
  if (e.code === 'VALIDATION_FAILED') return 'Hãy nhập email và mật khẩu hợp lệ.'
  if (e.status >= 500) return 'Máy chủ đang gặp sự cố. Hãy thử lại sau ít phút.'
  return e.message
}

export default function LoginScreen() {
  const { login, notice } = useAuth()
  const insets = useSafeAreaInsets()
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = email.trim() !== '' && password !== ''

  async function submit() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (e) {
      setError(loginMessage(e))
      setLoading(false)
    }
    // Đăng nhập xong: route bảo vệ tự chuyển sang tab, màn này bị gỡ nên không cần setLoading(false).
  }

  const message = error ?? notice

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandName}>KLTN Tư thế</Text>
          <Text style={text.body}>Theo dõi tư thế ngồi và nhận nhắc nhở ngay trên điện thoại.</Text>
        </View>

        <View style={styles.form}>
          {API_URL_MISSING ? (
            <Banner text="Chưa cấu hình EXPO_PUBLIC_API_URL. Sao chép .env.example thành .env rồi chạy lại ứng dụng." />
          ) : null}
          {message ? <Banner text={message} /> : null}

          <View style={styles.field}>
            <Text style={text.bodyStrong}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ten@congty.vn"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
              accessibilityLabel="Email"
            />
          </View>

          <View style={styles.field}>
            <Text style={text.bodyStrong}>Mật khẩu</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                editable={!loading}
                accessibilityLabel="Mật khẩu"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={styles.eye}>
                {showPassword ? (
                  <EyeOff size={20} color={colors.mutedForeground} />
                ) : (
                  <Eye size={20} color={colors.mutedForeground} />
                )}
              </Pressable>
            </View>
          </View>

          <Button label="Đăng nhập" onPress={submit} loading={loading} disabled={!canSubmit} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Banner({ text: message }: { text: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <TriangleAlert size={18} color={colors.destructive} />
      <Text style={[text.body, styles.bannerText]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.xxl },
  brand: { gap: space.sm },
  brandName: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, color: colors.primary },
  form: { gap: space.lg },
  field: { gap: space.sm - 2 },
  input: {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: space.md,
    fontFamily: fonts.regular,
    fontSize: 16, // >= 16 để iOS không tự phóng to khi focus
    color: colors.foreground,
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 52 },
  eye: { position: 'absolute', right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: colors.background,
  },
  bannerText: { flex: 1 },
})
