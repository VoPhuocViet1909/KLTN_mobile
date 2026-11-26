// Dựa trên GIT_frontend/src/lib/api/stats.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import type { ClassDistribution } from '@/lib/postureClass'
import { lastDays, msUntilNextVnDay, vnToday } from '@/lib/time'
import { request } from './client'

// analytics-service – team-sync mục 4.6

export interface Summary {
  /** trung bình có trọng số theo thời gian có mặt; null khi không có dữ liệu */
  meanScore: number | null
  badMinutes: number
  presenceMinutes: number
  /** số lần cảnh báo theo loại, ví dụ {NECK_TRUNK: 3} */
  alerts: Record<string, number>
}

export const sumAlerts = (alerts: Record<string, number>) =>
  Object.values(alerts).reduce((a, b) => a + b, 0)

export const fetchSummary = (range: { from: string; to: string }) =>
  request<Summary>({ url: '/stats/me/summary', params: range })

/** Số liệu hôm nay (từ 00:00 giờ Việt Nam). Mỗi lần tải lại tính lại `to` = bây giờ; khóa cache đổi khi sang ngày mới. */
export function useTodaySummary() {
  const [day, setDay] = useState(() => vnToday().from)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function updateDay() {
      clearTimeout(timer)
      setDay(vnToday().from)
      timer = setTimeout(updateDay, msUntilNextVnDay() + 1)
    }
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') updateDay()
    })
    updateDay()
    return () => {
      clearTimeout(timer)
      subscription.remove()
    }
  }, [])

  return useQuery({
    queryKey: ['stats', 'me', 'summary', 'today', day],
    queryFn: () => fetchSummary(vnToday()),
  })
}

export interface Bucket extends Summary {
  /** đầu khung; với bucket=day là 00:00 giờ Việt Nam (vd 2026-10-13T17:00:00Z = ngày 14/10) */
  start: string
}

export function useMyTimeseries(days: number, bucket: 'hour' | 'day' = 'day') {
  return useQuery({
    queryKey: ['stats', 'me', 'timeseries', days, bucket],
    queryFn: () =>
      request<Bucket[]>({ url: '/stats/me/timeseries', params: { ...lastDays(days), bucket } }),
  })
}

export interface HeatmapCell {
  /** 1 = Thứ Hai … 7 = Chủ Nhật, theo giờ Việt Nam */
  weekday: number
  /** 0–23, giờ Việt Nam */
  hour: number
  meanScore: number | null
}

/** Luôn đúng 168 ô (7 × 24). `weeks` 1–12. */
export function useMyHeatmap(weeks: number) {
  return useQuery({
    queryKey: ['stats', 'me', 'heatmap', weeks],
    queryFn: () => request<HeatmapCell[]>({ url: '/stats/me/heatmap', params: { weeks } }),
  })
}

/**
 * Số giây theo lớp tư thế (model v4) theo ngày hoặc tuần (giờ Việt Nam). Client/model cũ không gửi lớp thì
 * `classSec` < `presenceSec`; không có dữ liệu lớp thì `classSec` = 0.
 */
export const POSTURE_CLASSES_QUERY_KEY = ['stats', 'me', 'posture-classes'] as const

export function useMyPostureClasses(days: number, bucket: 'day' | 'week') {
  return useQuery({
    queryKey: [...POSTURE_CLASSES_QUERY_KEY, days, bucket],
    queryFn: () =>
      request<ClassDistribution>({ url: '/stats/me/posture-classes', params: { ...lastDays(days), bucket } }),
  })
}
