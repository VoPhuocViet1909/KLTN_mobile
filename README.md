# KLTN Tư thế – Mobile App

Ứng dụng di động (React Native + Expo + TypeScript) của đề tài giám sát tư thế ngồi. Mobile là **ứng dụng xem và nhận cảnh báo**:
không chạy AI, không mở camera; mọi dữ liệu lấy từ backend qua Gateway. Kế hoạch và phạm vi: `D:\KLTN\TaiLieu\Prompt_ClaudeCode_MobileApp.md`.

- Expo SDK 58, Expo Router (điều hướng theo file, thư mục `src/app/`).
- Gọi API: axios + TanStack Query, refresh token **một lần tại một thời điểm** (như Dashboard web).
- Token lưu bằng `expo-secure-store` (Keychain iOS / Keystore Android).
- Realtime: `socket.io-client` (chỉ WebSocket), sự kiện `status` / `config` (team-sync 4.7).
- Giao diện theo KLTN-DS-1 (cùng web/desktop): màu ở `src/theme/tokens.ts`, font Be Vietnam Pro, trạng thái luôn có icon + chữ.

## Cài đặt và chạy

Yêu cầu: Node 20+, backend đang chạy, **laptop và điện thoại cùng Wi-Fi**.

1. Cài thư viện: `npm install`
2. Tạo file `.env` từ mẫu: `copy .env.example .env`, rồi sửa `EXPO_PUBLIC_API_URL` thành địa chỉ Gateway theo **IP LAN của laptop**,
   ví dụ `http://192.168.1.16:8080`. Lấy IP bằng `ipconfig` (IPv4 của card Wi-Fi). Điện thoại không gọi được `localhost` của laptop.
3. Mở cổng 8080 trên Windows Firewall (PowerShell chạy bằng quyền Administrator):
   ```
   New-NetFirewallRule -DisplayName "KLTN Gateway 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
   ```
   Kiểm tra: mở `http://<IP-laptop>:8080/api/v1/health` bằng trình duyệt trên điện thoại, phải thấy `{"status":"UP"}`.
4. Chạy: `npx expo start` (đổi `.env` thì chạy `npx expo start -c`).
5. Trên iPhone: cài **Expo Go** từ App Store, mở Camera quét mã QR trong terminal. Android: mở Expo Go rồi quét QR.

### Backend

Trong `GIT_backend/DoAnTotNghiep_BE`: `docker compose up -d` (Gateway ở cổng 8080). Đặt `AUTH_SEED_DEMO=true` trong `.env` của
backend để có tài khoản thử; **email và mật khẩu demo nằm ở `AUTH_SEED_DEMO_EMAIL` / `AUTH_SEED_DEMO_PASSWORD` trong file
`.env` của backend** (không commit, không ghi ở đây).

## Màn hình hiện có

| Tab | Trạng thái |
| --- | --- |
| Đăng nhập | xong: lỗi tiếng Việt, hiện/ẩn mật khẩu, tự vào lại khi còn refresh token |
| Hôm nay | xong: trạng thái realtime (GOOD/BAD/AWAY/OFFLINE) + số liệu hôm nay |
| Lịch sử | xong: cảnh báo + phiên làm việc, 7/30/92 ngày, lọc loại, cuộn vô hạn |
| Thống kê | xong: điểm theo ngày, phút ngồi sai, heatmap thói quen 1/4/12 tuần |
| Tổ chức (ORG_ADMIN) | tạm "Sắp có" |
| Cài đặt | xong: form cấu hình cá nhân (kế thừa tổ chức) + tài khoản + đăng xuất |

## Kiểm tra

```
npx tsc --noEmit
npx expo-doctor
npx expo export --platform ios --output-dir dist-ios
npx expo export --platform android --output-dir dist-android
```

Kiểm với backend thật bằng script (không nằm trong app; cần Node 22, đã có `socket.io-client` trong `node_modules`):

```
set DEMO_EMAIL=...        (PowerShell: $env:DEMO_EMAIL="...")
set DEMO_PASSWORD=...
node dev/check-backend.mjs
```

Script chạy: login → refresh (token cũ phải bị từ chối) → `/auth/me` → `/stats/me/summary` → kết nối Socket.IO bằng WebSocket,
**không gửi header Origin** (giống app native) → logout.

## Cấu trúc

```
src/app/        route (Expo Router): login, (tabs)/index|history|stats|org|settings
src/api/        axios client (refresh một lần), tokenStore (SecureStore), auth, stats
src/realtime/   socket.io, hooks, StatusProvider (giữ trạng thái `status` qua các tab)
src/lib/        types, errors, labels, time – chép từ GIT_frontend/src/lib (dòng đầu mỗi file ghi nguồn)
src/components/ Card, Button, StatusBadge, Screen, các trạng thái loading/rỗng/lỗi
src/theme/      tokens.ts (màu, chữ, khoảng cách)
dev/            script kiểm tay với backend thật
```

File chép từ web ghi nguồn ở dòng đầu (`GIT_frontend`, commit `9d5677d`); khi web đổi logic thì cập nhật mobile cho khớp.

## Giới hạn đã biết

- Chưa kiểm trên iPhone/Android thật (chỉ kiểm tĩnh, build bundle và gọi API/Socket.IO bằng script).
- Giao diện sáng duy nhất (design system chưa có bảng màu tối được nghiệm thu).
- Push khi app tắt hẳn chưa có (Expo Go từ SDK 53 không nhận push từ server); xem kế hoạch Prompt 4.

Kiểm số liệu các màn Lịch sử / Thống kê / Cấu hình với backend thật (cần dữ liệu mẫu từ `replay.py`; script lưu rồi khôi phục cấu hình cá nhân):

```
node dev/check-data.mjs
```
