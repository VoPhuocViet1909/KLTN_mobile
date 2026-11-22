// Dựa trên GIT_frontend/src/lib/api/insights.ts (nhánh feat/health-risk-page), giữ đồng bộ khi web đổi.
import { useQuery } from '@tanstack/react-query'
import { request } from './client'

// health-insight-service – team-sync mục 4.11 (cảnh báo nguy cơ sức khỏe). Mức nguy cơ do LUẬT tính từ bảng tri thức có
// nguồn; AI (Gemini) chỉ viết lời giải thích. Đây không phải chẩn đoán y khoa.

export type Period = '7d' | '30d'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA'
export type Evidence = 'strong' | 'moderate' | 'weak'

export interface Indicator {
  key: string
  label: string
  /** null = chưa đo được */
  value: number | null
  mediumGte: number | null
  highGte: number | null
}

export interface Source {
  authors: string
  year: number | null
  journal: string | null
  title: string
  doi: string | null
  url: string | null
  type: string
  claim: string
}

export interface HealthRisk {
  kbId: string
  factor: string
  factorLabel: string
  risk: { vi: string; en: string }
  level: RiskLevel
  cappedByEvidence: boolean
  evidence: Evidence
  evidenceNote: string
  thresholdBasis: string
  indicators: Indicator[]
  explanation: string | null
  advice: string[]
  sources: Source[]
}

export interface MyHealthRisks {
  period: Period
  from: string
  to: string
  generatedAt: string
  kbVersion: string
  disclaimer: string
  status: 'OK' | 'INSUFFICIENT_DATA'
  inputs: Record<string, number | null>
  risks: HealthRisk[]
  summary: string
  /** "gemini": lời giải thích do AI viết và đã qua kiểm tra; "template": câu mẫu soạn sẵn */
  explanationSource: 'gemini' | 'template'
  /** vì sao dùng câu mẫu (no_api_key, quota, timeout, invalid_output: ...) hoặc null */
  explanationNote: string | null
}

export interface GroupRisk {
  kbId: string
  risk: { vi: string; en: string }
  evidence: Evidence
  low: number
  medium: number
  high: number
}

export interface OrgHealthRisks {
  period: Period
  kbVersion: string
  disclaimer: string
  status: 'OK' | 'SUPPRESSED'
  /** null khi nhóm quá nhỏ (không lộ cả số người) */
  groupSize: number | null
  minGroupSize: number
  departmentId: string | null
  risks: GroupRisk[]
  note: string | null
}

export function useMyHealthRisks(period: Period) {
  return useQuery({
    queryKey: ['insights', 'me', period],
    queryFn: () => request<MyHealthRisks>({ url: '/insights/me/health-risks', params: { period } }),
    staleTime: 60_000,
  })
}
