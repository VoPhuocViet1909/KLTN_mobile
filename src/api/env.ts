// Địa chỉ Gateway lấy từ .env (EXPO_PUBLIC_API_URL), xem .env.example.
const raw = process.env.EXPO_PUBLIC_API_URL?.trim() ?? ''

export const API_URL = raw.replace(/\/+$/, '')
export const API_BASE = `${API_URL}/api/v1`
export const API_URL_MISSING = API_URL === ''
