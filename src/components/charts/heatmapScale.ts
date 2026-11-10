// Chép từ GIT_frontend/src/components/charts/heatmapScale.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
// Thang tuần tự một màu xanh (nhạt = điểm thấp, đậm = điểm cao). 5 bậc cố định để so sánh được giữa các tuần.
export const SCORE_STEPS = [
  { min: 0, label: 'dưới 60', color: '#b7d3f6' },
  { min: 60, label: '60–69', color: '#6da7ec' },
  { min: 70, label: '70–79', color: '#2a78d6' },
  { min: 80, label: '80–89', color: '#1c5cab' },
  { min: 90, label: 'từ 90', color: '#104281' },
]

export const WEEKDAY_LABEL = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']
export const WEEKDAY_SHORT = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export const stepFor = (score: number) => [...SCORE_STEPS].reverse().find((s) => score >= s.min)!

export const hourRange = (h: number) => `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`
