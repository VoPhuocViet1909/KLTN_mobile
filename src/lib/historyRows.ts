import type { AlertItem, SessionItem } from '@/api/alerts'

export function historyRowKey(row: AlertItem | SessionItem) {
  return 'alertType' in row
    ? `alert|${row.userId}|${row.deviceId}|${row.sessionId}|${row.alertType}|${row.startedAt}`
    : `session|${row.deviceId}|${row.sessionId}`
}

/** Phân trang offset có thể trả lại một mục khi cảnh báo mới được thêm giữa hai lượt tải. */
export function uniqueHistoryRows<T extends AlertItem | SessionItem>(pages: readonly { items: readonly T[] }[]) {
  const rows = new Map<string, T>()
  for (const page of pages) {
    for (const row of page.items) rows.set(historyRowKey(row), row)
  }
  return [...rows.values()]
}
