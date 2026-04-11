import type { ConfidenceLabel } from "@prisma/client";
import type { OtpCandidate } from "@/types/domain";

const otpKeywords = [
  "otp",
  "verification code",
  "verification",
  "security code",
  "authentication code",
  "passcode",
  "one-time password",
  "ma xac thuc",
  "ma otp",
  "ma bao mat",
  "mã xác thực",
  "mã otp",
  "mã bảo mật",
  "認証コード",
  "確認コード",
  "セキュリティコード",
  "ワンタイムパスワード",
  "パスコード",
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
  "注文",
  "追跡",
  "金額",
  "合計",
];

const otpPattern = /\b(?:\d{6}|\d{8})\b/g;

function buildContextSnippet(source: string, start: number, codeLength: number) {
  return source
    .slice(Math.max(0, start - 100), start + codeLength + 100)
    .replace(/\s+/g, " ")
    .trim();
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
  return /https?:\/\/|www\.|[/?&=]/i.test(token);
}

function isStandaloneOtpMatch(source: string, start: number, codeLength: number) {
  return !isLinkLikeToken(getNonWhitespaceToken(source, start, codeLength));
}

function collectValidMatches(source: string) {
  return [...source.matchAll(otpPattern)]
    .map((match) => ({
      code: match[0],
      index: match.index ?? 0,
    }))
    .filter((match) => isStandaloneOtpMatch(source, match.index, match.code.length));
}

function collectUniqueCodes(source: string) {
  return [...new Set(collectValidMatches(source).map((match) => match.code))];
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

function buildGuaranteedCandidate(args: {
  code: string;
  source: string;
  score: number;
}) {
  const match = collectValidMatches(args.source).find((candidate) => candidate.code === args.code);
  const contextSnippet = buildContextSnippet(args.source, match?.index ?? 0, args.code.length);
  const contextLower = contextSnippet.toLowerCase();
  const matchedKeywords = otpKeywords.filter((keyword) => contextLower.includes(keyword.toLowerCase()));

  return {
    code: args.code,
    confidenceScore: args.score,
    confidenceLabel: "HIGH" as const,
    matchedKeywords,
    contextSnippet,
  };
}

export function extractOtpCandidates(args: {
  subject?: string | null;
  bodyText: string;
  fromHeader?: string | null;
}) {
  const bodyText = args.bodyText.trim();
  const source = `${args.subject ?? ""}\n${args.fromHeader ?? ""}\n${bodyText}`.trim();

  if (!source) {
    return [];
  }

  const uniqueBodyCodes = collectUniqueCodes(bodyText);
  if (uniqueBodyCodes.length === 1) {
    return [buildGuaranteedCandidate({ code: uniqueBodyCodes[0], source: bodyText, score: 0.99 })];
  }

  const uniqueSourceCodes = collectUniqueCodes(source);
  if (!bodyText && uniqueSourceCodes.length === 1) {
    return [buildGuaranteedCandidate({ code: uniqueSourceCodes[0], source, score: 0.96 })];
  }

  const subjectLower = (args.subject ?? "").toLowerCase();
  const candidates = new Map<string, OtpCandidate>();

  for (const match of collectValidMatches(source)) {
    const code = match.code;
    const start = match.index;
    const contextSnippet = buildContextSnippet(source, start, code.length);
    const contextLower = contextSnippet.toLowerCase();
    const matchedKeywords = otpKeywords.filter((keyword) => contextLower.includes(keyword.toLowerCase()));
    const subjectBoost = otpKeywords.some((keyword) => subjectLower.includes(keyword.toLowerCase())) ? 0.15 : 0;
    const fromBoost = /(noreply|security|verify|auth|account|認証|確認)/i.test(args.fromHeader ?? "") ? 0.1 : 0;
    const keywordBoost = Math.min(matchedKeywords.length * 0.16, 0.48);
    const uniquenessBoost = uniqueSourceCodes.length === 1 ? 0.2 : 0;
    const surroundingPenalty = negativeContextKeywords.some((keyword) => contextLower.includes(keyword.toLowerCase()))
      ? 0.15
      : 0;
    const confidenceScore = Math.max(
      0.1,
      Math.min(0.42 + subjectBoost + fromBoost + keywordBoost + uniquenessBoost - surroundingPenalty, 0.98),
    );
    const confidenceLabel = scoreToConfidence(confidenceScore);

    const previous = candidates.get(code);
    if (!previous || previous.confidenceScore < confidenceScore) {
      candidates.set(code, {
        code,
        confidenceScore,
        confidenceLabel,
        matchedKeywords,
        contextSnippet,
      });
    }
  }

  return [...candidates.values()].sort((left, right) => right.confidenceScore - left.confidenceScore);
}
