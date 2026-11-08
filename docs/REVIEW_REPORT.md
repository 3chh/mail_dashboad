**[APPROVED]**

Tôi đã kiểm tra trực tiếp trên mã nguồn hiện tại, không chỉ đọc patch, và tự chạy lại các bước kiểm tra:

- **Test:** `npx tsx tests/otp-extractor.test.ts` cho kết quả 16 PASSED, 0 FAILED.
- **Kiểu dữ liệu:** `npx tsc --noEmit` không báo lỗi.
- **Build:** tôi không chạy lại `npm run build`.
- **Thử thêm vài trường hợp ngoài bộ test:**
  - `１２３４５６` dạng full-width sau `認証コード` được nhận đúng, mức HIGH.
  - `482 913` có từ khóa được nhận là `482913`, mức HIGH.
  - Facebook 5 số kèm "mã xác nhận" được nhận, mức MEDIUM.
  - Số điện thoại `090-123-4567` bị loại.
  - `Order #123456` bị loại.

**Đối chiếu từng lỗi của lượt trước**
1. **Lọc năm và ngày:** `getLocalClause` và `isPrecededByDateLabel` đã có. Ngày dạng 8 số bị loại khi đứng sau nhãn ngày hoặc không có từ khóa OTP. Test 13 và 14 đều đạt.
2. **Microsoft Graph:** khi `folder === "inbox"` thì đọc đúng `/me/mailFolders/inbox/messages`, cùng phạm vi với `in:inbox` bên Gmail.
3. **Dọn code:** `resolveOtpSourceText` và các import thừa trong `lib/queries/app-data.ts` đã được xóa.

**Đánh giá chất lượng:** code bám sát SPEC ở cả 4 module.
- Thứ tự quét `prefixed` → `separated` → `plain` có cơ chế chống trùng vùng, nên không cắt đôi mã.
- Các bộ lọc loại trừ (link, mã màu, tiền, số trong cụm lớn hơn) được tách hàm rõ ràng.
- Phản hồi của `/api/otp` vẫn giữ các trường cũ, chỉ thêm `rawCode` và `folder`.

**Điểm nhỏ, không chặn merge, có thể xử lý sau:**
- `lib/mail/service.ts`, hàm `scanRefsForOtp`: email mới nhất chỉ được giữ lại khi chính email đầu tiên trong danh sách tải thành công (`i === 0`). Nếu email đó lỗi, mailbox không có OTP sẽ trả về `message: null`, dù các email sau tải được. Nên giữ email đầu tiên tải thành công thay vì cố định vị trí 0.
- Mỗi mailbox có thể tốn tới 13 lần gọi API tuần tự (10 email inbox + 3 email junk). Với hơn 500 mailbox, nên theo dõi độ trễ và giới hạn tốc độ (rate limit) của provider.
- Câu như "Your code is 4821" không được nhận, vì chữ "code" đứng một mình không nằm trong danh sách từ khóa. Hành vi này đúng SPEC, nhưng nên ghi nhận lại.
- Các file tạm chưa được git theo dõi (`fix_*.py`, `clean_types.py`, `git_diff.patch`, `prompt_p5*.txt`) không nên đưa vào commit.