import { extractOtpCandidates } from "../lib/extractors/otp";
import { htmlToPlainText } from "../lib/mail/parser";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log("=== RUNNING OTP EXTRACTION TEST SUITE ===\n");

// Case 1: Standard 6-digit OTP
{
  const res = extractOtpCandidates({
    subject: "Mã OTP của bạn",
    bodyText: "Mã OTP xác thực tài khoản của bạn là 654321. Mã có hiệu lực trong 5 phút.",
    fromHeader: "noreply@service.com"
  });
  assert(res.length > 0 && res[0].code === "654321", "Standard 6-digit OTP extracted (654321)");
}

// Case 2: 5-digit Facebook OTP
{
  const res = extractOtpCandidates({
    subject: "73023があなたのFacebook認証コードです",
    bodyText: "Honoka Yamashitaさん、アカウントの作成はもうすぐ完了です。73023があなたのFacebook認証コードです",
    fromHeader: "registration@facebookmail.com"
  });
  assert(res.length > 0 && res[0].code === "73023", "Facebook 5-digit OTP extracted (73023)");
}

// Case 3: 4-digit code with keyword
{
  const res = extractOtpCandidates({
    subject: "Security Alert",
    bodyText: "Mã xác thực đăng nhập của bạn là: 8901. Không chia sẻ mã này.",
    fromHeader: "security@bank.vn"
  });
  assert(res.length > 0 && res[0].code === "8901", "4-digit OTP with keyword extracted (8901)");
}

// Case 4: Delimited code (123-456)
{
  const res = extractOtpCandidates({
    subject: "Your verification code",
    bodyText: "Please use verification code 456-789 to complete your signup.",
    fromHeader: "auth@platform.io"
  });
  assert(res.length > 0 && res[0].code === "456789" && res[0].rawCode === "456-789", "Delimited code extracted (456-789 -> 456789)");
}

// Case 5: Google prefix code (G-123456)
{
  const res = extractOtpCandidates({
    subject: "Google verification code",
    bodyText: "G-987654 is your Google verification code.",
    fromHeader: "noreply@google.com"
  });
  assert(res.length > 0 && res[0].code === "987654" && res[0].rawCode === "G-987654", "Google prefix code extracted (G-987654 -> 987654)");
}

// Case 6: Full-width Japanese numbers
{
  const res = extractOtpCandidates({
    subject: "認証コードのご案内",
    bodyText: "認証コードは ３８２９１０ です。",
    fromHeader: "info@japan-service.jp"
  });
  assert(res.length > 0 && res[0].code === "382910", "Full-width Japanese digits normalized and extracted (382910)");
}

// Case 7: Pokemon Center Online passcode format
{
  const res = extractOtpCandidates({
    subject: "[ポケモンセンターオンライン]ログイン用パスコードのお知らせ",
    bodyText: "ログイン用パスコードをお知らせします。パスコード入力画面に下記のコードを入力してください。\n\n【パスコード】701722\n\n※パスコードの有効期限は5分間です。",
    fromHeader: "info@pokemoncenter-online.com"
  });
  assert(res.length > 0 && res[0].code === "701722", "Pokemon Center Online passcode extracted (701722)");
}

// Case 8: Microsoft Security code in HTML table (Smushed cells prevention)
{
  const html = `<table><tr><td>Security code: <span>137289</span></td></tr><tr><td>Only enter this code on an official website</td></tr></table>`;
  const text = htmlToPlainText(html);
  const res = extractOtpCandidates({
    subject: "Personal Microsoft account security code",
    bodyText: text,
    fromHeader: "account-security-noreply@accountprotection.microsoft.com"
  });
  assert(res.length > 0 && res[0].code === "137289", "Microsoft smushed table cell extracted (137289)");
}

// Case 9: Microsoft single-use code keyword
{
  const res = extractOtpCandidates({
    subject: "Your single-use code",
    bodyText: "Hi user, We received your request for a single-use code to use with your account: 289306",
    fromHeader: "account-security-noreply@accountprotection.microsoft.com"
  });
  assert(res.length > 0 && res[0].code === "289306", "Microsoft single-use code keyword matched (289306)");
}

// Case 10: Negative tests (No false positives)
{
  // Year without keyword
  const r1 = extractOtpCandidates({
    subject: "Newsletter 2026",
    bodyText: "Copyright © 2026 Pokemon Company. All rights reserved.",
    fromHeader: "newsletter@pokemon.com"
  });
  assert(r1.length === 0, "Negative test: Copyright year 2026 is NOT treated as OTP");

  // Hex color code #707070
  const r2 = extractOtpCandidates({
    subject: "Order Confirmation",
    bodyText: "Item color style: #707070. Order amount: $120.00.",
    fromHeader: "orders@shop.com"
  });
  assert(r2.length === 0, "Negative test: Hex color code #707070 is NOT treated as OTP");

  // Phone number
  const r3 = extractOtpCandidates({
    subject: "Contact Us",
    bodyText: "Please call customer support at +84-912-345-678 or 0912345678.",
    fromHeader: "support@service.com"
  });
  assert(r3.length === 0, "Negative test: Phone number is NOT treated as OTP");
}

// Case 11: Year-like 4-digit number WITH OTP keyword
{
  const res = extractOtpCandidates({
    subject: "Your login code",
    bodyText: "Your verification code is 2031. It expires in 10 minutes.",
    fromHeader: "security@auth.com"
  });
  assert(res.length > 0 && res[0].code === "2031", "Year-like 4-digit number with keyword accepted (2031)");
}

// Case 12: 8-digit standard OTP
{
  const res = extractOtpCandidates({
    subject: "Security verification",
    bodyText: "Enter security code 84729103 to approve this transaction.",
    fromHeader: "auth@bank.com"
  });
  assert(res.length > 0 && res[0].code === "84729103", "8-digit OTP extracted (84729103)");
}

// Case 13: 8-digit compact date without keyword (Negative test)
{
  const res = extractOtpCandidates({
    subject: "Report 20241105 attached",
    bodyText: "Please find the attached financial summary for date 20241105.",
    fromHeader: "finance@company.com"
  });
  assert(res.length === 0, "Negative test: 8-digit compact date without keyword is NOT treated as OTP");
}

// Case 14: 8-digit compact date next to real OTP code
{
  const res = extractOtpCandidates({
    subject: "Order confirmation",
    bodyText: "Order date 20241105. Your verification code is 482913. Do not share this code.",
    fromHeader: "auth@shopping.com"
  });
  assert(res.length === 1 && res[0].code === "482913", "Date filtered out and real OTP extracted (482913)");
}

// Case 15: Postal code in Pokemon Center footer (〒106-6147)
{
  const res = extractOtpCandidates({
    subject: "Pokemon Newsletter",
    bodyText: "株式会社ポケモン ポケモンセンターオンライン 〒106-6147 東京都港区六本木6-10-1 六本木ヒルズ森タワー47階",
    fromHeader: "info@pokemoncenter-online.com"
  });
  assert(res.length === 0, "Pokemon postal code 〒106-6147 is NOT treated as OTP");
}

// Case 16: Postal code in Bandai footer (〒108-0073)
{
  const res = extractOtpCandidates({
    subject: "Bandai Spirits Newsletter",
    bodyText: "株式会社BANDAI SPIRITS 〒108-0073 東京都港区三田3-5-27 住友不動産三田タワー",
    fromHeader: "shop_news@p-bandai.jp"
  });
  assert(res.length === 0, "Bandai postal code 〒108-0073 is NOT treated as OTP");
}

// Case 17: Postal code with English label (Zip code: 106-6147)
{
  const res = extractOtpCandidates({
    subject: "Shipping details",
    bodyText: "Package shipping destination. Postal code: 106-6147, Tokyo Japan.",
    fromHeader: "shipping@carrier.com"
  });
  assert(res.length === 0, "Postal code with label is NOT treated as OTP");
}

// Case 18: Postal code in Vietnamese (Mã bưu chính: 100-000)
{
  const res = extractOtpCandidates({
    subject: "Thông tin văn phòng",
    bodyText: "Địa chỉ nhận hồ sơ tại Hà Nội, Mã bưu chính: 100-000, Việt Nam.",
    fromHeader: "contact@company.vn"
  });
  assert(res.length === 0, "Vietnamese postal code is NOT treated as OTP");
}

// Case 19: Separated number without OTP keyword
{
  const res = extractOtpCandidates({
    subject: "Product Catalog",
    bodyText: "Product model number is 456-789. Please check user manual.",
    fromHeader: "catalog@shop.com"
  });
  assert(res.length === 0, "Separated number 456-789 without OTP keyword is rejected");
}

// Case 20: Both postal code in footer AND real OTP in body
{
  const res = extractOtpCandidates({
    subject: "[ポケモンセンターオンライン]ログイン用パスコードのお知らせ",
    bodyText: `ログイン用パスコードをお知らせします。パスコード入力画面に下記のコードを入力してください。

【パスコード】701722

※パスコードの有効期限は5分間です。

━━━━━━━━━━━━━━━━━━━━
発行・配信元 株式会社ポケモン ポケモンセンターオンライン 〒106-6147 東京都港区六本木6-10-1
━━━━━━━━━━━━━━━━━━━━`,
    fromHeader: "info@pokemoncenter-online.com"
  });
  assert(res.length === 1 && res[0].code === "701722", "Extracted real OTP (701722) while rejecting postal code (106-6147)");
}

// Case 21: Real Pokemon newsletter from live mailboxes fottakthyerefux / monatqyorba
{
  const res = extractOtpCandidates({
    subject: "【ポケカ】抽選販売の応募を受付中！【11月10日（火）16時59分まで】",
    bodyText: `拡張パック「ハドウシーカー」の抽選応募をチェックしてね！
このメールを Web ページとして表示するには、 こちらをクリックして下さい。
メールマガジン 2026年11月6日号
発行・配信元 株式会社ポケモン ポケモンセンターオンライン 〒106-6147 東京都港区六本木6-10-1 六本木ヒルズ森タワー47階 ©Pokémon/Nintendo/Creatures/GAME FREAK`,
    fromHeader: "ポケモンセンターオンライン <info@pokemoncenter-online.com>"
  });
  assert(res.length === 0, "Real Pokemon newsletter produces 0 candidates (no fake 1066147 OTP)");
}

console.log(`\n========================================`);
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL TESTS GREEN 100%!");
}
