# Kế hoạch Kiến trúc & Đặc tả Kỹ thuật (SPEC) - OTP Comprehensive Coverage

## 1. Mục tiêu
Nâng cấp toàn diện cơ chế phát hiện và trích xuất mã OTP cho hệ thống `gmail_dashboard` (hơn 500 mailboxes Hotmail/Outlook và Gmail):
- Bao phủ mọi định dạng OTP phổ biến: 4 đến 8 chữ số, mã có dấu gạch ngang (`123-456`), mã có tiền tố (`G-123456`, `FB-12345`).
- Xử lý triệt để lỗi dính chữ do HTML parser làm trượt ranh giới từ `\b`.
- Quét top 5–10 email gần nhất và fallback vào thư mục Junk/Spam thay vì chỉ lấy cứng 1 email mới nhất.
- Bộ lọc chống bắt nhầm năm (2024, 2025, 2026), mã màu hex (`#707070`), số tiền, ngày tháng khi không có từ khóa OTP.
- Duy trì tương thích ngược 100% với API `/api/otp` và giao diện `/otp`.

---

## 2. Thiết kế chi tiết theo 4 Module

### Module 1: HTML-to-Text Parser (`lib/mail/parser.ts`)
1. Cấu hình `html-to-text` với block selectors:
   ```typescript
   function htmlToPlainText(value: string) {
     return convert(value, {
       wordwrap: false,
       selectors: [
         { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
         { selector: "table", format: "block" },
         { selector: "tr", format: "block" },
         { selector: "td", format: "block" },
         { selector: "th", format: "block" },
         { selector: "p", format: "block" },
         { selector: "div", format: "block" },
         { selector: "h1", format: "block" },
         { selector: "h2", format: "block" },
         { selector: "h3", format: "block" },
         { selector: "li", format: "block" },
       ],
     });
   }
   ```
2. Đảm bảo `normalizeWhitespace` thay thế nhiều khoảng trắng/xuống dòng thành 1 dấu cách đơn, không làm dính các thẻ lân cận.

---

### Module 2: OTP Extractor Engine (`lib/extractors/otp.ts`)
1. **Chuẩn hóa chuỗi trước khi quét**:
   - Chuyển ký tự số full-width Nhật (`０-９`) thành half-width (`0-9`) qua `normalize('NFKC')`.
2. **Các mẫu Regex nhận dạng OTP**:
   - **Prefix code**: `/(?:G-|FB-|V-|ID-|#)(\d{4,8})\b/gi`
   - **Delimited code**: `/\b(\d{3,4})[- ](\d{3,4})\b/g` (chuẩn hóa `code: match[1] + match[2]`, `rawCode: match[0]`)
   - **Standard code**: `/\b\d{4,8}\b/g`
3. **Từ khóa mở rộng (EN, JA, VI)**:
   - EN: `otp`, `verification code`, `security code`, `authentication code`, `passcode`, `one-time password`, `single-use code`, `confirmation code`, `access code`, `pin code`.
   - JA: `認証コード`, `確認コード`, `セキュリティコード`, `ワンタイムパスワード`, `パスコード`, `認証番号`, `ログイン用パスコード`, `認証`.
   - VI: `mã xác thực`, `mã otp`, `mã bảo mật`, `mã xác nhận`, `mã xác minh`, `mã đăng nhập`.
4. **Bộ lọc loại trừ thông minh (Negative Filters)**:
   - Loại trừ năm 1990–2035 nếu không có từ khóa OTP trong ngữ cảnh liền kề (khoảng 30 ký tự).
   - Loại trừ mã màu hex (như `#707070` hay `color:#...`).
   - Loại trừ số tiền (`$1234`, `1234đ`, `1234 VND`, `1234 JPY`, `1234円`).
   - Loại trừ ngày tháng (`2026/04/16`, `16/04/2026`).
5. **Quy tắc Guaranteed Candidate**:
   - Chỉ áp dụng tự động nhận diện `HIGH 0.99` khi trong source chỉ có đúng 1 mã số 6–8 chữ số.
   - Với mã 4–5 chữ số: BẮT BUỘC phải có từ khóa OTP trong ngữ cảnh hoặc tiêu đề mới được công nhận.

---

### Module 3: Multi-Message & Folder Scanner (`lib/mail/service.ts`, `lib/mail/adapters/*`, `lib/queries/app-data.ts`)
1. **Adapter Microsoft Graph (`lib/mail/adapters/microsoft-graph.ts`)**:
   - Thêm tham số `folder?: "inbox" | "junkemail"` vào `listMicrosoftMessageRefs`.
   - Mặc định query `/me/messages` (hoặc `/me/mailFolders/inbox/messages`).
   - Hỗ trợ lấy từ `/me/mailFolders/junkemail/messages` khi cần.
2. **Adapter Gmail API (`lib/mail/adapters/gmail-api.ts`)**:
   - Thêm query `q?: string` (mặc định lấy inbox, fallback `in:spam`).
3. **Hàm tìm kiếm OTP tối ưu `fetchRecentOtpMessageForMailbox`**:
   - Nhận `maxScan?: number` (mặc định 5–10 email).
   - Lấy danh sách refs các email gần nhất.
   - Duyệt tuần tự từ email mới nhất đến cũ:
     * Fetch chi tiết email.
     * Chạy `extractOtpCandidates`.
     * Nếu có ứng viên OTP đạt độ tin cậy >= MEDIUM: Dừng và trả về ngay email đó kèm danh sách candidates.
   - Nếu Inbox không có email nào chứa OTP: Thử quét nhanh 3 email gần nhất trong Junk/Spam folder.
   - Nếu vẫn không có: Trả về email mới nhất của Inbox với `latestCandidate: null`.
4. **Cập nhật `getOtpMonitorData` trong `lib/queries/app-data.ts`**:
   - Chuyển sang gọi `fetchRecentOtpMessageForMailbox`.

---

### Module 4: API & UI Compatibility (`app/api/otp/route.ts`, `app/(app)/otp/page.tsx`)
1. Giữ nguyên 100% cấu trúc kết quả trả về của `POST /api/otp`:
   `mailboxId`, `emailAddress`, `code`, `confidenceScore`, `confidenceLabel`, `subject`, `from`, `receivedAt`, `contextSnippet`, `candidateCount`, `error`.
   Bổ sung: `rawCode?: string | null`, `folder?: "INBOX" | "JUNK"`.
2. Giao diện `/otp`: Hiển thị thêm badge thư mục ("Hộp thư đến" hoặc "Thư rác") nếu mã được tìm thấy trong Junk folder.

---

## 3. Danh sách Atomic Tasks (.trio/tasks.json)

```json
{
  "tasks": [
    {
      "id": "TASK-1",
      "title": "Nâng cấp bộ chuyển đổi HTML sang Text tránh dính chữ số",
      "component": "lib/mail/parser.ts",
      "agent": "codex",
      "description": "Thêm block selectors (table, tr, td, th, p, div, li) cho htmlToPlainText để ngắt dòng/cách từ rõ ràng."
    },
    {
      "id": "TASK-2",
      "title": "Mở rộng Engine trích xuất OTP hỗ trợ 4-8 số, phân tách gạch ngang, tiền tố và lọc năm/màu/tiền",
      "component": "lib/extractors/otp.ts",
      "agent": "codex",
      "description": "Cập nhật regex 4-8 ký tự, full-width normalization, prefix G-/FB-, bổ sung từ khóa đa ngôn ngữ EN/JA/VI, bảo vệ mã 4-5 số khỏi năm/zip code."
    },
    {
      "id": "TASK-3",
      "title": "Hỗ trợ quét thư mục Junk/Spam trong Microsoft Graph và Gmail adapters",
      "component": "lib/mail/adapters/microsoft-graph.ts, lib/mail/adapters/gmail-api.ts",
      "agent": "antigravity",
      "description": "Thêm tham số folder trong listMessageRefs để hỗ trợ truy vấn thư mục Junk/Spam khi cần."
    },
    {
      "id": "TASK-4",
      "title": "Cài đặt hàm fetchRecentOtpMessageForMailbox quét top 5-10 email",
      "component": "lib/mail/service.ts",
      "agent": "codex",
      "description": "Triển khai quét top 5-10 email gần nhất, ưu tiên email mới nhất có chứa OTP, fallback về Junk và email gần nhất."
    },
    {
      "id": "TASK-5",
      "title": "Tích hợp fetchRecentOtpMessageForMailbox vào getOtpMonitorData và resolveOtpSourceText",
      "component": "lib/queries/app-data.ts",
      "agent": "antigravity",
      "description": "Cập nhật getOtpMonitorData dùng hàm mới và gộp snippet + normalizedText vào source text."
    },
    {
      "id": "TASK-6",
      "title": "Đảm bảo API /api/otp và giao diện /otp tương thích",
      "component": "app/api/otp/route.ts, app/(app)/otp/page.tsx",
      "agent": "antigravity",
      "description": "Cung cấp thêm rawCode và folder trong response."
    },
    {
      "id": "TASK-7",
      "title": "Viết kiểm thử tự động xác thực các case OTP",
      "component": "tests/otp-extractor.test.ts",
      "agent": "codex",
      "description": "Tạo bộ test case bao phủ: mã 4-8 số, Facebook 5 số, Pokemon Center passcode, Microsoft single-use code, bảng HTML dính chữ, năm 2026."
    },
    {
      "id": "TASK-8",
      "title": "Chạy kiểm thử, build xác thực và test trực tiếp trên 10 mail KP",
      "component": "full system",
      "agent": "antigravity",
      "description": "Chạy npm run build và test trực tiếp với tài khoản live."
    }
  ]
}
```
