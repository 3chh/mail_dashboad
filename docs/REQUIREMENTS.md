# Yêu cầu: Mở rộng độ bao phủ trích xuất OTP (Pha 1 – Requirements)

> Đề bài: "đảm bảo nó bao được nhiều case OTP".
> Phạm vi code liên quan: `lib/mail/service.ts`, `lib/mail/parser.ts`, `lib/extractors/otp.ts`,
> `lib/mail/adapters/{gmail-api,microsoft-graph}.ts`, route `/api/otp`, trang `/otp`.

---

## 1. Mục tiêu & Phạm vi

### 1.1 Mục tiêu
Với một mailbox bất kỳ (Gmail hoặc Hotmail/Outlook), `/api/otp` và `/otp` trả về **đúng mã OTP mới nhất**
khi email OTP đã về, kể cả khi:
- có email quảng cáo/newsletter mới hơn đè lên trên;
- email OTP nằm trong Junk/Spam;
- mã có độ dài 4–8, có dấu phân cách, hoặc dạng chữ-số;
- email là HTML dạng bảng (Microsoft, Pokemon Center…);

và **không** trả nhầm năm, ngày, giá tiền, mã bưu điện, mã đơn hàng/tracking.

### 1.2 Hiện trạng (đã xác minh trong code)
| # | Vị trí | Hiện trạng | Hậu quả |
|---|---|---|---|
| H1 | `fetchLatestMessageForMailbox` (`lib/mail/service.ts`) | `maxResults: 1` | Email quảng cáo mới hơn → `code: null` |
| H2 | `htmlToPlainText` (`lib/mail/parser.ts`) | `html-to-text` với cấu hình tối giản, không ép xuống dòng cho `td/tr/span` lồng bảng | `137289Only` → `\b` trượt |
| H3 | `otpPattern` (`lib/extractors/otp.ts`) | `/\b(?:\d{6}|\d{8})\b/g` | Bỏ sót mã 4, 5, 7 số; mã `123-456`, `G-123456` |
| H4 | Adapter list message | Chỉ quét Inbox | Bỏ sót OTP trong Junk/Spam |
| H5 | `extractOtpCandidates` | Nếu body có **đúng 1** số khớp → gán HIGH 0.99 không cần keyword | Khi mở rộng sang 4 số, năm `2026` trong footer sẽ thành OTP "chắc chắn" |

Lưu ý: danh sách `otpKeywords` đã có sẵn nhiều từ khóa EN/JA/VI; cần **bổ sung** chứ không viết lại.

### 1.3 Trong phạm vi
1. Quét nhiều email gần nhất (N email, cửa sổ thời gian) thay vì 1, chọn email OTP phù hợp nhất.
2. Fallback sang Junk (Graph: `junkemail`) / Spam (Gmail: `in:spam` hoặc `includeSpamTrash`).
3. Chuẩn hóa HTML → text có ranh giới khối rõ ràng.
4. Mở rộng pattern: số 4–8, có phân cách, chữ-số; kèm chấm điểm theo ngữ cảnh.
5. Bộ lọc âm (năm, ngày, giờ, tiền, zip, số điện thoại, tracking/order, URL).
6. Bộ test fixture cho toàn bộ ma trận ở mục 2.

### 1.4 Ngoài phạm vi
- Đọc OTP trong ảnh/attachment (OCR).
- OTP dạng magic link (chỉ có URL, không có mã) – chỉ ghi nhận, không trích.
- Thay đổi schema Prisma lớn (chỉ cho phép thêm cột tùy chọn nếu thật cần, vd. `folder`).
- Thay đổi cơ chế xác thực OAuth/token.

---

## 2. Ma trận case OTP cần bao phủ

Ký hiệu kỳ vọng: ✅ phải trích đúng · ❌ phải **không** trích · ⚠️ trích với confidence ≤ MEDIUM.

### 2.1 Mã số chuẩn (4–8 chữ số)
| ID | Ví dụ nội dung | Nguồn điển hình | Kỳ vọng |
|---|---|---|---|
| N4-1 | `Your code is 4821` | SMS-gateway, game | ✅ `4821` |
| N4-2 | `認証コード：0193` (số 0 đầu) | JP site | ✅ `0193` (giữ số 0) |
| N5-1 | `09049 is your Facebook code` | Facebook | ✅ `09049` |
| N5-2 | `FB-73023` | Facebook subject | ✅ `73023` |
| N6-1 | `Security code: 137289` | Microsoft | ✅ `137289` |
| N6-2 | `パスコード 482913` | Pokemon Center Online | ✅ `482913` |
| N7-1 | `Mã xác thực của bạn là 1234567` | VN service | ✅ `1234567` |
| N8-1 | `Your one-time password: 12345678` | Bank/Steam | ✅ `12345678` |
| N-X | `123456789` (9+ số) | số tài khoản | ❌ |
| N-3 | `code 123` (≤3 số) | — | ❌ |

### 2.2 Mã có dấu phân cách
| ID | Ví dụ | Kỳ vọng |
|---|---|---|
| D1 | `123-456` | ✅ trả `123456` (chuẩn hóa bỏ phân cách) |
| D2 | `123 456` (khoảng trắng) sát keyword | ✅ `123456` |
| D3 | `12-34-56` | ✅ `123456` |
| D4 | `1234-5678` | ✅ `12345678` |
| D5 | `2026-11-08` (ngày ISO) | ❌ |
| D6 | `090-1234-5678` (SĐT JP) | ❌ |
| D7 | `123.456` / `1,234,567` (số/tiền) | ❌ |

Quyết định cần chốt ở Pha 2: trả mã **đã chuẩn hóa** (`123456`) trong field `code`, giữ nguyên bản gốc trong `contextSnippet` (đề xuất thêm field tùy chọn `rawCode`).

### 2.3 Mã chữ-số
| ID | Ví dụ | Kỳ vọng |
|---|---|---|
| A1 | `G-123456 is your Google verification code` | ✅ `G-123456` (giữ tiền tố, vì người dùng nhập đúng như vậy hoặc chỉ phần số – xem giả định G4) |
| A2 | `Your code: A7K9Q2` (chữ hoa + số, 6 ký tự, có ≥1 số và ≥1 chữ) | ✅ `A7K9Q2` – **chỉ khi** có keyword OTP trong ngữ cảnh gần |
| A3 | `Order #AB12CD34` | ❌ (negative keyword) |
| A4 | `Tracking: 1Z999AA10123456784` | ❌ (quá dài, tracking) |
| A5 | Từ tiếng Anh viết hoa `SECURE`, `VERIFY` | ❌ (không có chữ số) |
| A6 | Mã hex trong URL/CSS `#FF5733`, `a1b2c3` trong link | ❌ |

### 2.4 Từ khóa đa ngôn ngữ (bổ sung vào `otpKeywords`)
| Ngôn ngữ | Đã có | Cần bổ sung |
|---|---|---|
| EN | otp, verification code, security code, authentication code, passcode, one-time password | `single-use code`, `one-time code`, `login code`, `sign-in code`, `confirmation code`, `access code`, `your code is`, `is your … code`, `2fa`, `pin` (yếu) |
| JA | 認証コード, 確認コード, セキュリティコード, ワンタイムパスワード, パスコード | `認証番号`, `確認番号`, `ワンタイムコード`, `ログインコード`, `本人確認`, `コード` (yếu) |
| VI | mã xác thực, mã otp, mã bảo mật (có/không dấu) | `mã xác minh`, `mã kích hoạt`, `mã đăng nhập`, `mã xác nhận` (+ bản không dấu) |

Yêu cầu: so khớp **không phân biệt hoa thường**, chuẩn hóa Unicode (NFKC – để `：` full-width, số full-width `１２３４５６` được xử lý), VI so cả bản bỏ dấu.

### 2.5 Ma trận theo người gửi (fixture thực tế bắt buộc)
| Sender | Đặc điểm | Case |
|---|---|---|
| Microsoft account | HTML bảng, `Security code: <span>` | N6-1 + E1 |
| Pokemon Center Online | JP, パスコード, hay bị newsletter đè | N6-2 + E2 |
| Facebook | 5 số, mã nằm cả ở subject | N5-1/N5-2 |
| Google | `G-xxxxxx` ở subject | A1 |
| Newsletter Pokemon Center | không có OTP, nhiều năm/giá | ❌ toàn bộ |

---

## 3. Ràng buộc kỹ thuật & Giả định

### 3.1 Ràng buộc
- C1. **Hiệu năng**: >500 mailbox; một request `/api/otp` cho 1 mailbox nên ≤ 3s p95. Quét tối đa N=10 email (cấu hình được) trong cửa sổ mặc định 15 phút; Junk chỉ quét khi Inbox không ra OTP.
- C2. **Rate limit**: Graph (~10k req/10 phút/app/mailbox) và Gmail quota – ưu tiên lấy subject/preview trong lệnh list (`$select=subject,bodyPreview,receivedDateTime,from` / Gmail `snippet`) để lọc trước, chỉ fetch full body cho ứng viên.
- C3. **Không đổi contract** response hiện tại của `/api/otp` (field `code`, …); chỉ được **thêm** field tùy chọn (vd. `folder`, `rawCode`, `messageId`).
- C4. Không thêm dependency nặng; tiếp tục dùng `html-to-text` (cấu hình lại selectors) hoặc tiền xử lý regex.
- C5. Logic trích xuất phải là **hàm thuần**, test được bằng fixture không cần mạng.
- C6. Quyền Graph đọc `junkemail` đã có trong scope `Mail.Read` hiện tại; Gmail `gmail.readonly` đọc được Spam qua `includeSpamTrash=true` – cần xác nhận ở Pha 2.
- C7. Comment/thông báo người dùng cuối bằng tiếng Việt.

### 3.2 Giả định
- G1. OTP hợp lệ thường đến trong 15 phút gần nhất; email cũ hơn không được coi là OTP "hiện tại" (cho phép tham số `lookbackMinutes`).
- G2. Một email OTP chỉ chứa **một** mã OTP thật; nếu có nhiều ứng viên, ứng viên gần keyword nhất thắng.
- G3. Email mới nhất **có** OTP thắng email cũ hơn có OTP (không trộn mã giữa các email).
- G4. Với `G-123456`, trả `G-123456` trong `code`; cần người dùng xác nhận định dạng mong muốn cho tool tự động hóa (**câu hỏi mở Q1**).
- G5. Subject được coi là nguồn hợp lệ (Facebook, Google đưa mã vào subject).

---

## 4. Edge cases / Ngoại lệ

| ID | Tình huống | Yêu cầu xử lý |
|---|---|---|
| E1 | **HTML smushing**: `Security code: <span>137289</span></td></tr><tr><td>Only enter…` → `137289Only` | Chuyển HTML→text phải chèn xuống dòng/khoảng trắng tại ranh giới `td, tr, table, div, p, br, li, h*`; regex dùng lookaround ranh giới riêng (`(?<![A-Za-z0-9])…(?![A-Za-z0-9])`) thay vì chỉ `\b`. Đề xuất thêm: quét song song cả `text/plain` part nếu có. |
| E2 | **Marketing đè OTP**: newsletter mới hơn email OTP | Quét N email gần nhất trong cửa sổ thời gian, chọn email mới nhất có ứng viên ≥ MEDIUM. Email có dấu hiệu marketing (`List-Unsubscribe`, `unsubscribe`, `配信停止`, `hủy đăng ký`) bị trừ điểm, không bị loại hẳn. |
| E3 | **Junk/Spam**: OTP vào Junk | Inbox không có ứng viên ≥ MEDIUM → quét Junk/Spam cùng cửa sổ; response ghi `folder: "junk"`. Nếu cả 2 có OTP, chọn email mới hơn. |
| E4 | **Năm/ngày**: `© 2026`, `2025年11月8日`, `08/11/2026`, `Nov 8, 2025` | Loại số 4 chữ số trong khoảng 1900–2099 **trừ khi** đứng ngay sau keyword OTP (≤ ~30 ký tự, cùng dòng). Loại mẫu ngày/giờ (`dd/mm/yyyy`, `yyyy-mm-dd`, `hh:mm`, `年月日`). |
| E5 | **Bỏ cơ chế "unique = 0.99"** (H5) cho mã 4–5 số và chữ-số | Mã 4–5 số / chữ-số bắt buộc có keyword hoặc subject/from boost mới đạt HIGH. 6–8 số giữ hành vi cũ để không hồi quy. |
| E6 | **Zip / SĐT / tiền**: `〒150-0001`, `ZIP 90210`, `¥5,500`, `$1234`, `+84 912 345 678` | ❌ – negative context (`〒`, `zip`, `postal`, ký hiệu tiền, `tel`, `電話`) và mẫu SĐT. |
| E7 | **Order/tracking/invoice ID** | Giữ `negativeContextKeywords`, bổ sung `order number`, `注文番号`, `お問い合わせ番号`, `mã đơn hàng`, `invoice no`. |
| E8 | **Số trong URL/ảnh/CSS** (`?id=482913`, `width="600"`, `#123456`) | Giữ `isLinkLikeToken`; loại token nằm trong thuộc tính HTML (đã được html-to-text loại) và mã hex màu. |
| E9 | **Nhiều mã trong 1 email** (mã mới + "mã cũ đã hết hạn") | Chọn mã gần keyword nhất, ưu tiên xuất hiện đầu tiên trong body. |
| E10 | **Số full-width** `１２３４５６`, dấu `：` | Chuẩn hóa NFKC trước khi trích. |
| E11 | **Email OTP nhưng đã quá cửa sổ thời gian** | Trả `code: null` + thông báo tiếng Việt "Không tìm thấy mã OTP mới trong X phút gần nhất". |
| E12 | **Mailbox lỗi token / Junk không truy cập được** | Lỗi Junk không làm hỏng kết quả Inbox; log cảnh báo, trả kết quả Inbox. |
| E13 | **Magic link không có mã** | `code: null`, không trích số rác từ URL. |

---

## 5. Tiêu chí chấp nhận (Acceptance Criteria)

### AC-1 Trích xuất (unit test, fixture không mạng)
- [ ] Toàn bộ case ✅ ở mục 2 trả đúng `code` với confidence HIGH (hoặc ≥ MEDIUM với A2).
- [ ] Toàn bộ case ❌ ở mục 2 và E4, E6, E7, E8, E13 **không** xuất hiện trong candidate HIGH/MEDIUM.
- [ ] Fixture Microsoft HTML bảng (E1) trả `137289`.
- [ ] Fixture newsletter Pokemon Center (chỉ có năm, giá, zip) trả `[]` hoặc chỉ LOW.
- [ ] Toàn bộ test hiện có của extractor vẫn pass (không hồi quy 6/8 số).

### AC-2 Chọn email (unit test với adapter mock)
- [ ] Inbox: [newsletter (mới nhất), OTP email] → trả mã của OTP email.
- [ ] Inbox không OTP, Junk có OTP → trả mã, `folder = "junk"`.
- [ ] Inbox và Junk đều có OTP → trả mã của email mới hơn.
- [ ] Không quá N lệnh fetch full body mỗi mailbox mỗi request.
- [ ] OTP cũ hơn `lookbackMinutes` → `code: null` + thông báo tiếng Việt.

### AC-3 Tích hợp
- [ ] `/api/otp` giữ nguyên shape response cũ; field mới là tùy chọn.
- [ ] `/otp` hiển thị đúng mã và (nếu có) nhãn thư mục Junk.
- [ ] `npm run build` và lint pass; test suite pass.
- [ ] Kiểm thử thủ công trên ≥1 mailbox Hotmail và ≥1 Gmail thật với: Microsoft security code, Facebook 5 số, Pokemon Center パスコード.

### AC-4 Hiệu năng
- [ ] p95 ≤ 3s/mailbox trong kịch bản Inbox + Junk fallback (đo trên mailbox thật hoặc mock có độ trễ).

---

## 6. Câu hỏi mở (cần chốt trước Pha 2)
- Q1. Mã chữ-số `G-123456`: tool tự động cần `G-123456` hay `123456`?
- Q2. Mã có phân cách `123-456`: trả bản chuẩn hóa `123456` (đề xuất) hay giữ nguyên?
- Q3. Giá trị mặc định N (số email quét) và `lookbackMinutes` – đề xuất N=10, 15 phút.
- Q4. Có cần lọc theo sender (vd. `?sender=pokemoncenter`) để chọn đúng OTP khi nhiều dịch vụ gửi cùng lúc không?
