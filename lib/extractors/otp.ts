import type { ConfidenceLabel } from "@prisma/client";
import type { OtpCandidate } from "@/types/domain";

const otpKeywords = [
  "otp",
  "one-time password",
  "one time password",
  "one-time code",
  "single-use code",
  "verification code",
  "verification",
  "confirmation code",
  "security code",
  "authentication code",
  "login code",
  "sign-in code",
  "passcode",
  "access code",
  "pin code",
  "認証コード",
  "確認コード",
  "パスコード",
  "ログイン用パスコード",
  "認証番号",
  "認証",
  "確認番号",
  "セキュリティコード",
  "ワンタイムパスワード",
  "mã xác thực",
  "mã otp",
  "mã bảo mật",
  "mã xác minh",
  "mã đăng nhập",
  "mã xác nhận",
  "ma xac thuc",
  "ma otp",
  "ma bao mat",
  "ma xac minh",
  "ma dang nhap",
];

const negativeContextKeywords = [
  "invoice",
  "order",
  "price",
  "amount",
  "qty",
  "quantity",
  "tracking",
  "subtotal",
  "shipping",
  "phone",
  "tel",
  "注文",
  "追跡",
  "金額",
  "合計",
  "đơn hàng",
  "số tiền",
];

const fromBoostPattern = /(noreply|no-reply|security|verify|auth|account|認証|確認)/i;

// Thứ tự quan trọng: prefix/separated chạy trước để plain không cắt đôi chúng.
const prefixedPattern = /\b([A-Z]{1,4})-(\d{4,8})\b/g;
const separatedPattern = /\b(\d{3,4})([- ])(\d{3,4})\b/g;
const plainPattern = /\b\d{4,8}\b/g;

const currencyBeforePattern = /(?:[$€£¥₫₩]|usd|vnd|jpy|eur|yen|đ)\s?$/i;
const currencyAfterPattern = /^\s?(?:[$€£¥₫₩円元]|usd|vnd|jpy|eur|yen|đồng|dong|đ\b|k\b)/i;
const postalBeforePattern = /(?:[〒〶]|郵便番号|\b(?:zip(?:\s*code)?|postal(?:\s*code)?|bưu\s*chính|mã\s*bưu\s*(?:chính|điện)|buu\s*chinh|ma\s*buu\s*(?:chinh|dien))\b)[\s:=]*$/i;

type MatchKind = "plain" | "separated" | "prefixed";

type RawMatch = {
  code: string;
  rawCode: string;
  index: number;
  kind: MatchKind;
};

/** NFKC đưa số/ký tự full-width (１２３４５６, ：) về ASCII; độ dài chuỗi có thể đổi nên chỉ normalize một lần ở đầu. */
function normalizeSource(value: string) {
  return value.normalize("NFKC").replace(/ /g, " ");
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

function findKeywords(context: string) {
  const lower = context.toLowerCase();
  const lowerAscii = stripDiacritics(lower);
  return otpKeywords.filter((keyword) => {
    const key = keyword.toLowerCase();
    // "otp" ngắn: bắt buộc biên từ để không khớp nhầm "footprint".
    if (key === "otp") {
      return /(^|[^a-z])otp([^a-z]|$)/.test(lower);
    }
    return lower.includes(key) || lowerAscii.includes(stripDiacritics(key));
  }).filter((keyword, index, all) =>
    // Bỏ biến thể không dấu trùng nghĩa để không cộng điểm keyword hai lần.
    all.findIndex((other) => stripDiacritics(other.toLowerCase()) === stripDiacritics(keyword.toLowerCase())) === index,
  );
}

function buildContextSnippet(source: string, start: number, codeLength: number) {
  return source
    .slice(Math.max(0, start - 100), start + codeLength + 100)
    .replace(/\s+/g, " ")
    .trim();
}

/** Lấy mệnh đề / dòng cụm từ liền kề (không vượt qua ngắt câu hoặc xuống dòng) để khớp từ khóa chính xác. */
function getLocalClause(source: string, start: number, codeLength: number) {
  let left = Math.max(0, start - 60);
  for (let i = start - 1; i >= left; i--) {
    const ch = source[i];
    if (ch === "\n" || ch === "\r" || ch === "。" || (ch === "." && i < start - 1 && /\s/.test(source[i + 1] ?? ""))) {
      left = i + 1;
      break;
    }
  }

  let right = Math.min(source.length, start + codeLength + 60);
  for (let i = start + codeLength; i < right; i++) {
    const ch = source[i];
    if (ch === "\n" || ch === "\r" || ch === "。" || (ch === "." && /\s/.test(source[i + 1] ?? ""))) {
      right = i;
      break;
    }
  }

  return source.slice(left, right);
}

function isPrecededByDateLabel(source: string, start: number) {
  const before = source.slice(Math.max(0, start - 30), start).toLowerCase();
  return /\b(date|dated|ngày|ngay|day|time|dob)\b[\s:=]*$/i.test(before);
}

function getNonWhitespaceToken(source: string, start: number, codeLength: number) {
  let left = start;
  let right = start + codeLength;

  while (left > 0 && !/\s/.test(source[left - 1] ?? "")) {
    left -= 1;
  }

  while (right < source.length && !/\s/.test(source[right] ?? "")) {
    right += 1;
  }

  return source.slice(left, right);
}

function isLinkLikeToken(token: string) {
  return /https?:\/\/|www\.|[/?&=@]/i.test(token);
}

function isYear(code: string) {
  if (code.length !== 4) {
    return false;
  }
  const value = Number(code);
  return value >= 1990 && value <= 2035;
}

/** yyyymmdd hoặc ddmmyyyy hợp lệ trong khoảng 1990-2035. */
function isCompactDate(code: string) {
  if (code.length !== 8) {
    return false;
  }
  const valid = (y: number, m: number, d: number) => y >= 1990 && y <= 2035 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  const n = (from: number, to: number) => Number(code.slice(from, to));
  return valid(n(0, 4), n(4, 6), n(6, 8)) || valid(n(4, 8), n(2, 4), n(0, 2));
}

function isHexColor(source: string, start: number) {
  return source[start - 1] === "#";
}

function isCurrency(source: string, start: number, length: number) {
  const before = source.slice(Math.max(0, start - 5), start);
  const after = source.slice(start + length, start + length + 6);
  return currencyBeforePattern.test(before) || currencyAfterPattern.test(after);
}

function isPostalCode(source: string, start: number) {
  const before = source.slice(Math.max(0, start - 25), start);
  return postalBeforePattern.test(before);
}

/** Số nằm trong cụm lớn hơn: ngày (12/05/2024), giờ (12:30), số tiền (1,234.56), số điện thoại (090-123-4567). */
function isPartOfLargerNumber(source: string, start: number, length: number) {
  const prev = source[start - 1] ?? "";
  const prevPrev = source[start - 2] ?? "";
  const next = source[start + length] ?? "";
  const nextNext = source[start + length + 1] ?? "";
  const joiner = /[./:,\-]/;
  return (joiner.test(prev) && /\d/.test(prevPrev)) || (joiner.test(next) && /\d/.test(nextNext));
}

function isExcluded(source: string, match: RawMatch) {
  const { index, rawCode, code, kind } = match;
  const length = rawCode.length;

  if (isLinkLikeToken(getNonWhitespaceToken(source, index, length))) {
    return true;
  }
  if (isHexColor(source, index) || isCurrency(source, index, length)) {
    return true;
  }
  if (isPostalCode(source, index)) {
    return true;
  }
  if (kind === "prefixed") {
    return false;
  }
  if (isPartOfLargerNumber(source, index, length)) {
    return true;
  }
  return false;
}

function collectRawMatches(source: string) {
  const matches: RawMatch[] = [];
  const occupied: Array<[number, number]> = [];
  const overlaps = (start: number, end: number) => occupied.some(([s, e]) => start < e && end > s);

  const push = (match: RawMatch) => {
    const end = match.index + match.rawCode.length;
    if (overlaps(match.index, end)) {
      return;
    }
    occupied.push([match.index, end]);
    if (!isExcluded(source, match)) {
      matches.push(match);
    }
  };

  for (const m of source.matchAll(prefixedPattern)) {
    push({ code: m[2], rawCode: m[0], index: m.index ?? 0, kind: "prefixed" });
  }
  for (const m of source.matchAll(separatedPattern)) {
    const code = m[1] + m[3];
    if (code.length >= 6 && code.length <= 8) {
      push({ code, rawCode: m[0], index: m.index ?? 0, kind: "separated" });
    }
  }
  for (const m of source.matchAll(plainPattern)) {
    push({ code: m[0], rawCode: m[0], index: m.index ?? 0, kind: "plain" });
  }

  return matches.sort((left, right) => left.index - right.index);
}

/** Lọc theo quy tắc keyword: 4-5 số và mọi mã separated bắt buộc có từ khóa OTP gần đó. */
function collectValidMatches(source: string) {
  return collectRawMatches(source)
    .map((match) => {
      const contextSnippet = buildContextSnippet(source, match.index, match.rawCode.length);
      const localClause = getLocalClause(source, match.index, match.rawCode.length);
      const matchedKeywords = findKeywords(localClause);
      return { ...match, contextSnippet, matchedKeywords };
    })
    .filter((match) => {
      if (isCompactDate(match.code) && (match.matchedKeywords.length === 0 || isPrecededByDateLabel(source, match.index))) {
        return false;
      }
      if (match.matchedKeywords.length > 0 || match.kind === "prefixed") {
        return true;
      }
      if (match.code.length < 6) {
        return false;
      }
      if (isYear(match.code) || isCompactDate(match.code)) {
        return false;
      }
      return match.kind !== "separated";
    });
}

type ValidMatch = ReturnType<typeof collectValidMatches>[number];

function uniqueByCode(matches: ValidMatch[]) {
  return [...new Map(matches.map((match) => [match.code, match])).values()];
}

function scoreToConfidence(score: number): ConfidenceLabel {
  if (score >= 0.8) {
    return "HIGH";
  }

  if (score >= 0.55) {
    return "MEDIUM";
  }

  return "LOW";
}

function toCandidate(match: ValidMatch, confidenceScore: number, confidenceLabel = scoreToConfidence(confidenceScore)): OtpCandidate {
  return {
    code: match.code,
    rawCode: match.rawCode,
    confidenceScore,
    confidenceLabel,
    matchedKeywords: match.matchedKeywords,
    contextSnippet: match.contextSnippet,
  };
}

/** Guaranteed HIGH chỉ cho mã duy nhất 6-8 số; 4-5 số luôn đi qua chấm điểm. */
function tryGuaranteed(matches: ValidMatch[], score: number) {
  const unique = uniqueByCode(matches);
  if (unique.length !== 1 || unique[0].code.length < 6) {
    return null;
  }
  const match = unique[0];
  if (isYear(match.code) || isCompactDate(match.code)) {
    return null;
  }
  return [toCandidate(match, score, "HIGH")];
}

export function extractOtpCandidates(args: {
  subject?: string | null;
  bodyText: string;
  fromHeader?: string | null;
}): OtpCandidate[] {
  const subject = normalizeSource(args.subject ?? "");
  const fromHeader = normalizeSource(args.fromHeader ?? "");
  const bodyText = normalizeSource(args.bodyText).trim();
  const source = `${subject}\n${fromHeader}\n${bodyText}`.trim();

  if (!source) {
    return [];
  }

  const bodyMatches = collectValidMatches(bodyText);
  const guaranteedBody = tryGuaranteed(bodyMatches, 0.99);
  if (guaranteedBody) {
    return guaranteedBody;
  }

  const sourceMatches = collectValidMatches(source);
  if (!bodyText) {
    const guaranteedSource = tryGuaranteed(sourceMatches, 0.96);
    if (guaranteedSource) {
      return guaranteedSource;
    }
  }

  const uniqueSourceCount = uniqueByCode(sourceMatches).length;
  const subjectBoost = findKeywords(subject).length > 0 ? 0.15 : 0;
  const fromBoost = fromBoostPattern.test(fromHeader) ? 0.1 : 0;
  const candidates = new Map<string, OtpCandidate>();

  for (const match of sourceMatches) {
    const contextLower = match.contextSnippet.toLowerCase();
    const keywordBoost = Math.min(match.matchedKeywords.length * 0.16, 0.48);
    const prefixBoost = match.kind === "prefixed" ? 0.15 : 0;
    const uniquenessBoost = uniqueSourceCount === 1 ? 0.2 : 0;
    const shortPenalty = match.code.length < 6 ? 0.1 : 0;
    const surroundingPenalty = negativeContextKeywords.some((keyword) => contextLower.includes(keyword))
      ? 0.15
      : 0;
    const confidenceScore = Math.max(
      0.1,
      Math.min(
        0.42 + subjectBoost + fromBoost + keywordBoost + prefixBoost + uniquenessBoost - shortPenalty - surroundingPenalty,
        0.98,
      ),
    );

    const previous = candidates.get(match.code);
    if (!previous || previous.confidenceScore < confidenceScore) {
      candidates.set(match.code, toCandidate(match, confidenceScore));
    }
  }

  return [...candidates.values()].sort((left, right) => right.confidenceScore - left.confidenceScore);
}
