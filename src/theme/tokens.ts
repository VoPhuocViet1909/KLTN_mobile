// Token màu KLTN-DS-1, đổi từ GIT_frontend/src/index.css (đã là hex). Giữ đồng bộ khi web đổi.
// Chưa có bảng màu tối được nghiệm thu: app luôn dùng giao diện sáng.

export const colors = {
  surface: '#f4f5f3', // nền ứng dụng
  background: '#ffffff', // nền panel
  foreground: '#1c2433', // chữ chính
  mutedForeground: '#5b6472', // chữ phụ
  muted: '#eef0ec',
  secondary: '#eef1f6',
  accent: '#e8eef8',
  primary: '#256abf',
  primaryForeground: '#ffffff',
  destructive: '#d03b3b',
  border: '#e1e4df',
  input: '#d5d9d3',
  ring: '#2a78d6',
  chart: ['#2a78d6', '#86b6ef', '#1c5cab', '#cde2fb', '#104281'],
  status: {
    good: '#0ca30c',
    bad: '#d03b3b',
    away: '#c98500',
    offline: '#8a8f98',
  },
} as const

export const radius = { control: 6, panel: 11 } as const

/** Bước 4px. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const

/** Cỡ chữ theo design system: tiêu đề trang 24, mục 16, nội dung 14, ghi chú 12, số lớn 48. */
export const text = {
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32, color: colors.foreground },
  section: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, color: colors.foreground },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.foreground },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.foreground },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  hero: { fontFamily: fonts.semibold, fontSize: 48, lineHeight: 56, color: colors.foreground },
} as const
