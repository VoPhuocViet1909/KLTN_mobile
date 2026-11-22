// Dựa trên GIT_frontend/src/lib/healthRisk.ts (nhánh feat/health-risk-page), giữ đồng bộ khi web đổi.
import type { Evidence, HealthRisk, Indicator, RiskLevel, Source } from '@/api/insights'

/** Câu miễn trừ luôn hiện, kể cả khi dữ liệu chưa tải hoặc lỗi. */
export const DISCLAIMER = 'Đây không phải chẩn đoán y khoa; nếu đau kéo dài hãy gặp bác sĩ.'

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Vừa',
  HIGH: 'Cao',
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu',
}

export const EVIDENCE_LABEL: Record<Evidence, string> = { strong: 'mạnh', moderate: 'vừa', weak: 'yếu' }

/** Thứ tự hiện thẻ: nặng trước, chưa đủ dữ liệu cuối. */
const ORDER: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INSUFFICIENT_DATA: 3 }
export const sortRisks = (risks: HealthRisk[]) =>
  [...risks].sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.kbId.localeCompare(b.kbId))

/** Vì sao dùng câu mẫu thay vì lời giải thích của AI, bằng lời người dùng hiểu được. */
export function noteLabel(note: string | null): string | null {
  if (!note) return null
  if (note === 'no_api_key') return 'Chưa bật AI giải thích.'
  if (note === 'quota' || note === 'daily_limit' || note === 'daily_user_limit') return 'Hết hạn mức gọi AI trong ngày.'
  if (note === 'timeout' || note === 'network' || note === 'upstream') return 'AI tạm thời không phản hồi.'
  if (note.startsWith('invalid_output')) return 'Câu trả lời của AI không qua bước kiểm tra nên không dùng.'
  return 'Không dùng được lời giải thích của AI.'
}

/** Giá trị chỉ số: tỉ lệ hiện phần trăm, còn lại một chữ số thập phân; null là "Chưa đo". */
export function formatIndicator(key: string, value: number | null): string {
  if (value === null || value === undefined) return 'Chưa đo'
  if (key.endsWith('Ratio')) return `${Math.round(value * 100)}%`
  return `${Math.round(value * 10) / 10}`
}

export function formatThreshold(key: string, value: number | null): string | null {
  return value === null ? null : formatIndicator(key, value)
}

/** Vị trí 0..100 của thanh: tới ngưỡng "cao" (hoặc gấp đôi ngưỡng "vừa" khi không có ngưỡng cao). */
export function barPercent(i: Indicator): number {
  if (i.value === null) return 0
  const top = i.highGte ?? (i.mediumGte !== null ? i.mediumGte * 2 : null)
  if (!top || top <= 0) return i.value > 0 ? 100 : 0
  return Math.max(0, Math.min(100, (i.value / top) * 100))
}

export function markerPercent(i: Indicator, threshold: number | null): number | null {
  if (threshold === null) return null
  const top = i.highGte ?? (i.mediumGte !== null ? i.mediumGte * 2 : null)
  if (!top || top <= 0) return null
  return Math.max(0, Math.min(100, (threshold / top) * 100))
}

/** Liên kết mở nguồn: DOI qua doi.org, hoặc URL của nguồn; chỉ chấp nhận https. */
export function sourceHref(s: Source): string | null {
  if (s.doi) return `https://doi.org/${s.doi}`
  return s.url && s.url.startsWith('https://') ? s.url : null
}

export function citation(s: Source): string {
  const parts = [s.authors, s.year ? `(${s.year})` : null, s.title, s.journal].filter(Boolean)
  return parts.join('. ')
}
