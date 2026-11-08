**[APPROVED]**

Bản sửa đúng theo SPEC và có thể merge.

**Cách tôi kiểm tra:** đọc diff của `lib/extractors/otp.ts`, đối chiếu từng Module trong `docs/SPEC.md`, rồi tự chạy lại test và một số câu thử của riêng tôi. `npx tsx tests/otp-extractor.test.ts` cho kết quả **23 passed, 0 failed**. Tôi không chạy lại `npm run build` và không thử lại trên 2 mailbox hotmail thật.

**1. Đúng đắn và an toàn**
- `isPostalCode` chỉ xét tối đa 25 ký tự trước mã, và mẫu regex buộc nhãn phải đứng sát mã (`[\s:=]*$`). Vì vậy không chặn nhầm khi chữ "postal" nằm ở chỗ khác trong thư.
- Regex không có lượng từ lồng nhau và đầu vào bị giới hạn, nên không có nguy cơ treo máy do regex (ReDoS).
- Lớp chặn này đặt trong `isExcluded()`, trước nhánh `prefixed`, đúng như Module 1 yêu cầu.

**2. Loại mã bưu chính và mã gạch ngang không từ khóa**
- Thư có `Your verification code is 123456. Ship to postal code 1066147` chỉ trả về `123456`.
- Thư có `郵便番号 1066147 認証コード 482913` chỉ trả về `482913`.
- `〒106-6147`, `Zip: 482913`, `Mã bưu chính 100000` đều trả về rỗng.
- Trong `collectValidMatches()`, mã có từ khóa hoặc mã `prefixed` đã được giữ lại ở bước trước. Vì vậy lệnh `return false` cho `separated` chỉ loại mã gạch ngang hoặc dấu cách **không có từ khóa**, đúng Module 2.

**3. Không hồi quy**
- `456-789` có từ khóa vẫn ra `456789`, còn `456-789` không có từ khóa bị loại.
- `G-123456` và mã số full-width Nhật (`８４２９１３` ra `842913`) vẫn được nhận.
- Lớp chặn `isYear` và `isCompactDate` trong `tryGuaranteed()` chỉ ngăn những mã đó được đẩy thẳng lên HIGH. Chúng vẫn có thể được chấm điểm theo đường thường.

**Vài điểm nhỏ, không chặn merge:**
- `otp.ts:189`: SPEC ghi xét 20 ký tự, code dùng 25. Nên sửa một trong hai cho khớp; 25 cũng hợp lý.
- `otp.ts:258`: docstring vẫn ghi "mã tách bằng dấu cách", cần sửa thành "mã `separated`".
- Có thể gộp đoạn `if (match.kind === "separated") return false; return true;` thành `return match.kind !== "separated";`.
- Trước khi commit, nên xoá hoặc thêm vào `.gitignore` các file tạm: `git_diff.patch` và `prompt_p*.txt`.

**Chất lượng mã:** thay đổi nhỏ, đúng chỗ, không đụng đến luồng khác. Test đã phủ cả trường hợp cần loại và trường hợp OTP hợp lệ.