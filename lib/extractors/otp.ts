import type { ConfidenceLabel } from "@prisma/client";
import type { OtpCandidate } from "@/types/domain";

const otpKeywords = [
  "otp",
  "verification code",
  "security code",
  "authentication code",
  "passcode",
  "one-time password",
  "mã xác thực",
  "mã otp",
  "mã bảo mật",
];

const otpPatterns = [/\b\d{4}\b/g, /\b\d{6}\b/g, /\b\d{8}\b/g];

function scoreToConfidence(score: number): ConfidenceLabel {
  if (score >= 0.8) {
    return "HIGH";
  }

  if (score >= 0.55) {
    return "MEDIUM";
  }

  return "LOW";
}

export function extractOtpCandidates(args: {
  subject?: string | null;
  bodyText: string;
  fromHeader?: string | null;
}) {
  const source = `${args.subject ?? ""}\n${args.fromHeader ?? ""}\n${args.bodyText}`.trim();
  const candidates = new Map<string, OtpCandidate>();

  for (const pattern of otpPatterns) {
    for (const match of source.matchAll(pattern)) {
      const code = match[0];
      const start = match.index ?? 0;
      const context = source.slice(Math.max(0, start - 100), start + code.length + 100);
      const contextLower = context.toLowerCase();
      const matchedKeywords = otpKeywords.filter((keyword) => contextLower.includes(keyword));
      const subjectBoost = otpKeywords.some((keyword) =>
        (args.subject ?? "").toLowerCase().includes(keyword),
      )
        ? 0.15
        : 0;
      const fromBoost = /(noreply|security|verify|auth|account)/i.test(args.fromHeader ?? "")
        ? 0.1
        : 0;
      const lengthBoost = code.length === 6 ? 0.1 : 0;
      const keywordBoost = Math.min(matchedKeywords.length * 0.18, 0.54);
      const surroundingPenalty = /\$|usd|vnd|invoice|order|qty|price/i.test(context)
        ? 0.15
        : 0;
      const baseScore = 0.28 + subjectBoost + fromBoost + lengthBoost + keywordBoost - surroundingPenalty;
      const confidenceScore = Math.max(0.1, Math.min(baseScore, 0.98));
      const confidenceLabel = scoreToConfidence(confidenceScore);
      const snippet = context.replace(/\s+/g, " ").trim();

      if (confidenceScore < 0.38) {
        continue;
      }

      const previous = candidates.get(code);
      if (!previous || previous.confidenceScore < confidenceScore) {
        candidates.set(code, {
          code,
          confidenceScore,
          confidenceLabel,
          matchedKeywords,
          contextSnippet: snippet,
        });
      }
    }
  }

  return [...candidates.values()].sort((left, right) => right.confidenceScore - left.confidenceScore);
}
