// Chép từ GIT_frontend/src/lib/configFields.ts (commit 9d5677d), giữ đồng bộ khi web đổi.
// Các khóa cấu hình NGƯỜI DÙNG được sửa trên Dashboard.
// min/max: `api_handover/schemas/config.schema.json` (cùng bộ kiểm với backend, team-sync mục 4.4).
// mặc định: `DEFAULTS` trong `posture_model/app_config.py` (App tự có; server không trả mặc định).
//
// KHÔNG đưa vào đây: user_id, api_base_url, api_token (backend từ chối/bỏ qua) và các khóa hiệu chỉnh riêng máy
// calib_distance_cm, camera_focal_px, camera_hfov_deg, calib_sec (App tự đo). Xem PRESERVED_KEYS.

export type GroupId = 'posture' | 'distance' | 'shoulder' | 'rest' | 'notify' | 'advanced'

export interface ConfigField {
  key: string
  label: string
  group: GroupId
  kind: 'number' | 'integer' | 'boolean'
  unit?: string
  min?: number
  max?: number
  /** bước của ô nhập số */
  step?: number
  /** mặc định của App; null = App lấy từ mô hình */
  default: number | boolean | null
  /** schema cho phép null (ở đây: "theo mô hình") */
  nullable?: boolean
  /** một câu giải thích ngắn */
  hint: string
  /** chữ hiện trong ô khi để mặc định mà mặc định là null */
  defaultText?: string
}

export const GROUPS: { id: GroupId; title: string; description?: string }[] = [
  { id: 'posture', title: 'Cảnh báo tư thế' },
  { id: 'distance', title: 'Khoảng cách màn hình' },
  { id: 'shoulder', title: 'Lệch vai', description: 'Để mặc định thì App dùng ngưỡng của mô hình.' },
  { id: 'rest', title: 'Nghỉ ngơi' },
  { id: 'notify', title: 'Thông báo' },
  { id: 'advanced', title: 'Nâng cao', description: 'Chỉ đổi khi hiểu rõ tác dụng; mặc định đã hợp lý.' },
]

export const CONFIG_FIELDS: ConfigField[] = [
  // --- Cảnh báo tư thế
  {
    key: 'alert_sec', label: 'Chờ trước khi cảnh báo', group: 'posture', kind: 'number', unit: 'giây',
    min: 1, max: 120, default: 5, hint: 'Ngồi sai liên tục bao lâu thì mới báo.',
  },
  {
    key: 'clear_sec', label: 'Xác nhận đã ngồi đúng', group: 'posture', kind: 'number', unit: 'giây',
    min: 0.5, max: 60, step: 0.5, default: 3, hint: 'Ngồi đúng liên tục bao lâu thì coi là đã sửa.',
  },
  {
    key: 'repeat_sec', label: 'Nhắc lại sau', group: 'posture', kind: 'number', unit: 'giây',
    min: 0, max: 3600, default: 240, hint: 'Vẫn ngồi sai sau bấy lâu thì nhắc lại, mức cảnh báo tăng. Đặt 0 để không nhắc lại.',
  },
  {
    key: 'cooldown_sec', label: 'Giãn cách giữa hai lần báo', group: 'posture', kind: 'number', unit: 'giây',
    min: 0, max: 3600, default: 60, hint: 'Hai lần cảnh báo cùng loại cách nhau tối thiểu bấy lâu.',
  },

  // --- Khoảng cách màn hình
  {
    key: 'distance_on_cm', label: 'Báo khi ngồi gần hơn', group: 'distance', kind: 'number', unit: 'cm',
    min: 20, max: 120, default: 50, hint: 'Ngồi gần màn hình hơn mức này thì cảnh báo; dưới 50 cm mắt dễ mỏi, khô hơn.',
  },
  {
    key: 'distance_off_cm', label: 'Hết báo khi ngồi xa hơn', group: 'distance', kind: 'number', unit: 'cm',
    min: 20, max: 130, default: 55, hint: 'Phải ngồi xa hơn mức này mới hết cảnh báo; không nhỏ hơn mức báo.',
  },

  // --- Lệch vai
  {
    key: 'shoulder_tilt_on', label: 'Báo khi vai lệch hơn', group: 'shoulder', kind: 'number', unit: '°',
    min: 0.5, max: 30, step: 0.5, default: null, nullable: true, defaultText: 'Theo mô hình (≈ 3,5°)',
    hint: 'Góc nghiêng vai vượt mức này thì cảnh báo.',
  },
  {
    key: 'shoulder_tilt_off', label: 'Hết báo khi vai lệch dưới', group: 'shoulder', kind: 'number', unit: '°',
    min: 0, max: 30, step: 0.5, default: null, nullable: true, defaultText: 'Theo mô hình (≈ 2,5°)',
    hint: 'Góc nghiêng vai xuống dưới mức này mới hết cảnh báo; không lớn hơn mức báo.',
  },

  // --- Nghỉ ngơi
  {
    key: 'sit_limit_min', label: 'Nhắc đứng dậy sau', group: 'rest', kind: 'number', unit: 'phút',
    min: 0, max: 240, default: 30, hint: 'Ngồi liên tục bấy lâu thì nhắc vận động. Nghiên cứu khuyên đứng dậy mỗi 30–60 phút. Đặt 0 để tắt.',
  },
  {
    key: 'sit_repeat_min', label: 'Nhắc đứng dậy lặp lại mỗi', group: 'rest', kind: 'number', unit: 'phút',
    min: 1, max: 120, default: 10, hint: 'Sau lần nhắc đầu, nhắc lại sau mỗi khoảng này nếu vẫn ngồi.',
  },
  {
    key: 'eye_break_min', label: 'Nhắc nghỉ mắt mỗi', group: 'rest', kind: 'number', unit: 'phút',
    min: 0, max: 120, default: 20, hint: 'Cứ ngồi bấy lâu thì nhắc nhìn xa vài chục giây, theo quy tắc 20-20-20. Đặt 0 để tắt.',
  },
  {
    key: 'away_sec', label: 'Coi là vắng mặt sau', group: 'rest', kind: 'number', unit: 'giây',
    min: 5, max: 600, default: 30, hint: 'Không thấy người trước camera bấy lâu thì tính là vắng mặt.',
  },

  // --- Thông báo
  {
    key: 'notify_toast', label: 'Thông báo trên màn hình', group: 'notify', kind: 'boolean',
    default: true, hint: 'Hiện thông báo nhỏ khi có cảnh báo.',
  },
  {
    key: 'notify_sound', label: 'Âm thanh', group: 'notify', kind: 'boolean',
    default: true, hint: 'Phát tiếng báo khi có cảnh báo.',
  },
  {
    key: 'notify_popup', label: 'Cửa sổ nổi khi sai kéo dài', group: 'notify', kind: 'boolean',
    default: true, hint: 'Chỉ hiện ở mức cao (nhắc từ lần thứ ba).',
  },

  // --- Nâng cao
  {
    key: 'p_bad_threshold', label: 'Ngưỡng cúi cổ, gù lưng', group: 'advanced', kind: 'number',
    min: 0.05, max: 0.95, step: 0.05, default: null, nullable: true, defaultText: 'Theo mô hình',
    hint: 'Xác suất mô hình cho là ngồi sai; thấp hơn thì báo nhạy hơn.',
  },
  {
    key: 'p_bad_hysteresis', label: 'Độ trễ của ngưỡng', group: 'advanced', kind: 'number',
    min: 0, max: 0.4, step: 0.05, default: 0.1, hint: 'Khoảng đệm quanh ngưỡng để cảnh báo không chớp tắt liên tục.',
  },
  {
    key: 'batch_interval_sec', label: 'Chu kỳ gửi dữ liệu', group: 'advanced', kind: 'number', unit: 'giây',
    min: 1, max: 300, default: 5, hint: 'App gom dữ liệu và gửi lên máy chủ mỗi khoảng này.',
  },
  {
    key: 'batch_max', label: 'Số mục tối đa mỗi lần gửi', group: 'advanced', kind: 'integer', unit: 'mục',
    min: 1, max: 500, default: 100, hint: 'Giới hạn kích thước một lô gửi lên máy chủ.',
  },
  {
    key: 'metrics_window_sec', label: 'Cửa sổ gộp số liệu', group: 'advanced', kind: 'integer', unit: 'giây',
    min: 10, max: 600, default: 60, hint: 'Số liệu tư thế được gộp theo từng khoảng này trước khi gửi.',
  },
]

export const FIELD_BY_KEY: Record<string, ConfigField> = Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, f]))

/**
 * Khóa riêng máy mà App ghi (hiệu chỉnh camera). Không hiện, nhưng nếu GET có thì PUT phải gửi lại nguyên vẹn:
 * PUT thay toàn bộ phần cá nhân, bỏ sót là xóa mất hiệu chỉnh của người dùng.
 */
export const PRESERVED_KEYS = ['calib_distance_cm', 'camera_focal_px', 'camera_hfov_deg', 'calib_sec'] as const

/** Giá trị mặc định dùng để so cặp ngưỡng khi một bên để mặc định. */
export const DISTANCE_DEFAULTS = { on: 50, off: 55 }
