Tôi đã ghi `docs/REQUIREMENTS.md` (Pha 1). Lưu ý: file này trước đó đang chứa tài liệu Pha 1 của đợt mở rộng độ bao phủ OTP và **đã bị ghi đè**. Bản cũ vẫn còn trong git ở commit `74653ba`. Trong repo cũng có một tài liệu riêng cùng chủ đề là `docs/otp-coverage-requirements.md`.

Đây là tài liệu phân tích nên chưa có code hay test nào được chạy. Tôi đã mở code để đối chiếu và xác nhận RCA đúng với code thực tế ở `lib/extractors/otp.ts` và `lib/mail/service.ts`.

**Nội dung chính:**
1. **Tuyên bố vấn đề:** chuỗi 5 bước gây lỗi được trình bày thành bảng, kèm vị trí dòng code:
   - regex `separatedPattern` khớp nhầm mã bưu điện;
   - `isExcluded` không có bộ lọc `〒`;
   - `collectValidMatches` chỉ chặn mã tách bằng dấu cách, mã gạch ngang lọt qua;
   - `tryGuaranteed` gắn ngay mác HIGH;
   - `scanRefsForOtp` thấy HIGH nên dừng quét.
2. **Phạm vi:** 4 yêu cầu R1–R4 (lọc bưu chính, bắt buộc từ khóa cho mã tách, trả kết quả rỗng kèm thông báo tiếng Việt, test hồi quy), cùng tiêu chí chấp nhận AC1–AC4.
3. **Trường hợp biên:** 10 case E1–E10, trong đó có `456-789` kèm từ khóa, `G-123456`, thư có cả OTP lẫn mã bưu điện, và trường hợp OTP thật nằm ở thư thứ 3. Có thêm các ràng buộc về tương thích ngược.

**Những điểm tôi phát hiện thêm ngoài RCA đã cho:**
- `〒1066147` (không có gạch) và `〒１０６－６１４７` (số và gạch toàn khổ) cũng sẽ bị nhận nhầm. Vì vậy bộ lọc phải áp dụng cho mọi dạng mã và chạy sau bước chuẩn hoá NFKC.
- Đề xuất quy tắc: khi có dấu hiệu bưu chính `〒` thì loại mã đó **dù có từ khóa OTP đi kèm** (case E8). Đây là một quyết định nghiệp vụ, nhờ bạn xác nhận ở Pha 2.