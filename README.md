# Mailbox Center

Ứng dụng web quản lý tập trung nhiều hộp thư Gmail và Hotmail/Outlook cá nhân.

## Tổng quan kiến trúc

- Admin đăng nhập bằng tài khoản hệ thống riêng
- Mỗi mailbox Gmail / Hotmail consent **một lần đầu** để lấy `refresh token`
- Server lưu token đã mã hoá vào database
- Hệ thống sync thư về PostgreSQL theo lịch hoặc sync thủ công
- Search, OTP, trích xuất đơn hàng đọc trên local store

> **Pilot hiện tại:** tối ưu cho **5 Gmail** + **5 Hotmail**

---

## Tính năng hiện có

| Tính năng | Mô tả |
|---|---|
| Admin sign-in | Đăng nhập bằng `CredentialsProvider` |
| Quản lý mailbox | Tạo mailbox Gmail / Outlook trong dashboard |
| OAuth connect | Kết nối từng mailbox qua Gmail API hoặc Microsoft Graph |
| Lưu token | `refresh token` được mã hoá, lưu vào database |
| Sync mail | Sync mailbox theo lô, chọn cửa sổ 1 / 7 / 30 ngày |
| Local search | Tìm kiếm trên nhiều mailbox đã chọn |
| OTP monitor | Theo dõi OTP theo từng mailbox |
| Order extraction | Trích xuất đơn hàng theo mailbox |
| Export CSV | Xuất dữ liệu đơn hàng ra file CSV |

---

## Tech stack

- **Next.js 16** App Router
- **React 19**
- **NextAuth**
- **Prisma** + PostgreSQL
- **Gmail API**
- **Microsoft Graph API**
- **Tailwind CSS** + shadcn/ui

---

## Kiến trúc chính

### Data models

```
AdminUser · Mailbox · MailboxOAuthState · MailMessage · ScanJob · OtpDetection · OrderExtraction
```

### Provider layer

```
lib/mail/adapters/gmail-api.ts
lib/mail/adapters/microsoft-graph.ts
```

---

## Hướng dẫn cài đặt

### Bước 1 — Tạo OAuth credentials

#### Gmail API

1. Mở [Google Cloud Console](https://console.cloud.google.com).
2. Tạo project hoặc chọn project có sẵn.
3. **Enable** Gmail API.
4. Tạo **OAuth client ID** loại `Web application`.
5. Thêm redirect URI:

```
<APP_PUBLIC_URL>/api/oauth/google/callback
```

6. Lấy `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`.

**Scope cần cấp:**

```
openid · email · profile · https://www.googleapis.com/auth/gmail.readonly
```

#### Microsoft Graph — Hotmail / Outlook cá nhân

1. Mở [Microsoft Entra — App registrations](https://entra.microsoft.com).
2. Tạo app registration hỗ trợ **personal Microsoft accounts**.
3. Cấu hình redirect URI:

```
<APP_PUBLIC_URL>/api/oauth/outlook/callback
```

4. Tạo client secret.
5. Cấp **delegated permissions:**

```
openid · email · profile · offline_access · User.Read · Mail.Read
```

6. Lấy `MICROSOFT_CLIENT_ID` và `MICROSOFT_CLIENT_SECRET`.

> Khuyến nghị đặt `MICROSOFT_TENANT_ID=consumers`.

---

### Bước 2 — Cấu hình biến môi trường

```bash
cp .env.example .env
```

Điền các giá trị sau vào `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=consumers

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
ADMIN_NAME=Mailbox Admin

MAIL_TOKEN_SECRET=replace-with-a-second-long-random-string
CRON_SECRET=replace-with-a-cron-secret
OTP_API_TOKEN=replace-with-an-otp-api-token

NEXTAUTH_SECRET=replace-with-a-long-random-string
APP_PUBLIC_URL=http://localhost:3000
APP_INTERNAL_URL=http://127.0.0.1:3000
NEXTAUTH_URL=http://localhost:3000

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gmail_dashboard?schema=public"
```

**Giải thích các biến quan trọng:**

| Biến | Mục đích |
|---|---|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap tài khoản admin đầu tiên |
| `MAIL_TOKEN_SECRET` | Mã hoá refresh token mailbox trong database |
| `CRON_SECRET` | Xác thực endpoint cron sync |
| `OTP_API_TOKEN` | Cho phép tool ngoài gọi API lấy OTP (có thể bỏ trống nếu chỉ dùng session web) |
| `APP_PUBLIC_URL` | URL public duy nhất của app, dùng cho redirect login và OAuth |
| `APP_INTERNAL_URL` | URL nội bộ để server tự gọi lại nếu cần |

Tạo secret ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Bước 3 — Cài dependencies

```bash
npm install
```

---

### Bước 4 — Khởi tạo database

Đảm bảo PostgreSQL đang chạy và database `gmail_dashboard` đã tồn tại.

```bash
# Generate Prisma client
npm run db:generate

# Tạo migration và apply vào PostgreSQL
npm run db:migrate

# Apply migration trên môi trường deploy (không tạo migration mới)
npm run db:apply

# Mở Prisma Studio
npm run db:studio
```

---

### Bước 5 — Chạy app

```bash
npm run dev
```

Truy cập `<APP_PUBLIC_URL>` trên trình duyệt.

---

## Hướng dẫn sử dụng (Pilot)

### Đăng nhập admin

1. Mở `<APP_PUBLIC_URL>`.
2. Đăng nhập bằng `ADMIN_EMAIL` và `ADMIN_PASSWORD`.

### Tạo mailbox

1. Vào **Dashboard**.
2. Nhập email mailbox.
3. Chọn **Gmail** hoặc **Hotmail / Outlook**.
4. Bấm **Thêm mailbox**.

### Kết nối (consent) từng mailbox

1. Tại dòng mailbox, bấm **Connect**.
2. Đăng nhập đúng account mailbox đó.
3. Chấp nhận scope đọc mail.
4. Sau callback thành công, mailbox chuyển sang `ACTIVE`.

> Gmail cá nhân và Hotmail cá nhân đều cần consent **một lần đầu**. Sau đó server giữ refresh token và không cần đăng nhập lại mỗi ngày.

### Sync mail

1. Chọn một hoặc nhiều mailbox trên dashboard.
2. Chọn cửa sổ sync: **1**, **7**, hoặc **30** ngày.
3. Bấm **Sync selected**.
4. Vào **Sync Jobs** để theo dõi tiến độ.

### Tìm kiếm

1. Chọn mailbox trên dashboard hoặc trong trang **Search**.
2. Tìm theo keyword, sender, date, unread, attachment.
3. Kết quả đọc từ local DB — không fetch trực tiếp từ provider.

### OTP

1. Vào **OTP**.
2. Chọn mailbox.
3. Lọc theo sender / date / unread nếu cần.
4. Copy OTP từ local detections.

### Đơn hàng (Orders)

1. Vào **Orders**.
2. Chọn mailbox.
3. Xem merchant, amount, status, item summary.
4. Export CSV nếu cần.

---

## API lấy OTP (dành cho automation)

```
POST /api/otp
Authorization: Bearer <OTP_API_TOKEN>
Content-Type: application/json
```

**Request — một mailbox:**

```json
{
  "emailAddress": "account@example.com"
}
```

**Request — nhiều mailbox:**

```json
{
  "emailAddress": ["a@example.com", "b@example.com"]
}
```

**Response:**

```json
{
  "results": [
    {
      "mailboxId": "...",
      "emailAddress": "account@example.com",
      "code": "123456",
      "confidenceLabel": "HIGH",
      "subject": "...",
      "receivedAt": "2026-04-28T00:00:00.000Z",
      "error": null
    }
  ]
}
```

---

## Scheduled sync

Endpoint cron:

```
POST /api/cron/sync
Authorization: Bearer <CRON_SECRET>
```

Hành vi hiện tại:

- Lấy danh sách mailbox `ACTIVE`
- Bỏ qua mailbox đã sync trong vòng 5 phút gần nhất
- Xếp sync job cơ bản

> Đây là skeleton cho pilot. Khi lên production cần chuyển sang queue bền vững hơn (BullMQ, v.v.).

---

## Các file quan trọng

```
app/(app)/dashboard/page.tsx
app/(auth)/sign-in/page.tsx
app/api/mailboxes/route.ts
app/api/oauth/google/start/route.ts
app/api/oauth/google/callback/route.ts
app/api/oauth/outlook/start/route.ts
app/api/oauth/outlook/callback/route.ts
app/api/scan-jobs/route.ts
app/api/cron/sync/route.ts
lib/auth/auth-options.ts
lib/auth/admin.ts
lib/mail/adapters/gmail-api.ts
lib/mail/adapters/microsoft-graph.ts
lib/mail/service.ts
lib/jobs/scan-runner.ts
prisma/schema.prisma
```

---

## Ghi chú kỹ thuật

- Sync jobs hiện chạy **in-process** để test pilot nhanh
- Search / OTP / Orders là **local-first** (đọc từ DB, không fetch live)
- Refresh token được **mã hoá**, không lưu plain text

---

## Hạn chế hiện tại

- Chưa có queue bền vững (BullMQ, v.v.)
- Chưa có batch onboarding tool cho hàng trăm mailbox
- Chưa có reconnect UX đầy đủ khi token bị revoke
- Chưa có auto incremental sync chuẩn hoá theo cursor / history / delta
- Chưa có telemetry và rate-limit handling mức production

---

## Hướng tiếp theo

Sau pilot, nên làm tiếp:

1. Queue bền vững cho sync jobs
2. Retry policy + exponential backoff
3. Reconnect flow rõ ràng cho mailbox lỗi
4. Dashboard theo dõi stale mailbox / token revoke
5. Batch onboarding workflow cho nhiều mailbox
