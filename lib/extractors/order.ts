import type { ConfidenceLabel } from "@prisma/client";
import type { OrderExtractionResult } from "@/types/domain";

const orderKeywords = [
  "order",
  "invoice",
  "receipt",
  "payment",
  "transaction",
  "shipping",
  "delivered",
  "purchase",
  "booking",
  "đơn hàng",
  "biên nhận",
  "thanh toán",
  "giao hàng",
  "hóa đơn",
];

const statusPatterns: Array<[RegExp, string]> = [
  [/delivered|đã giao/i, "Delivered"],
  [/shipped|dispatch|out for delivery|đang giao/i, "Shipped"],
  [/processing|confirmed|xác nhận/i, "Confirmed"],
  [/paid|payment received|đã thanh toán/i, "Paid"],
  [/cancelled|canceled|refund|refunded|đã hủy/i, "Cancelled"],
];

const currencyMap: Array<[RegExp, string]> = [
  [/\bUSD\b|\$/i, "USD"],
  [/\bVND\b|₫/i, "VND"],
  [/\bEUR\b|€/i, "EUR"],
  [/\bGBP\b|£/i, "GBP"],
];

function confidenceFromScore(score: number): ConfidenceLabel {
  if (score >= 0.8) {
    return "HIGH";
  }

  if (score >= 0.55) {
    return "MEDIUM";
  }

  return "LOW";
}

function parseOrderDate(text: string) {
  const matches = [
    text.match(/\b(\d{4}-\d{2}-\d{2})\b/),
    text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/),
    text.match(/\b([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4})\b/),
  ];

  for (const match of matches) {
    if (!match?.[1]) {
      continue;
    }

    const candidate = new Date(match[1]);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }

  return null;
}

function parseAmount(text: string) {
  const amountRegex =
    /(?:total|amount|paid|payment|grand total|tổng cộng|thanh toán)[^\d]{0,12}([$€£₫]?\s?\d[\d,.\s]*)/i;
  const match = text.match(amountRegex);
  if (!match?.[1]) {
    return {
      totalAmount: null,
      currency: null,
    };
  }

  const raw = match[1].trim();
  const currency = currencyMap.find(([pattern]) => pattern.test(raw) || pattern.test(text))?.[1] ?? null;
  const numeric = raw.replace(/[^\d.,]/g, "");
  const normalized = numeric.includes(",") && numeric.includes(".")
    ? numeric.replace(/,/g, "")
    : numeric.replace(/,/g, ".");
  const totalAmount = Number.parseFloat(normalized);

  return {
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
    currency,
  };
}

function parseOrderId(text: string) {
  const patterns = [
    /(?:order|booking|invoice|receipt|transaction)[\s#:]*([A-Z0-9-]{5,})/i,
    /(?:mã đơn hàng|mã giao dịch)[\s#:]*([A-Z0-9-]{5,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function parseCustomerName(text: string) {
  const match = text.match(/(?:customer|bill to|ship to|hello|hi|xin chào)[\s,:-]+([A-Z][A-Za-z.' -]{2,40})/i);
  return match?.[1]?.trim() ?? null;
}

function parseMerchantName(fromHeader: string | null, subject: string | null) {
  const fromNameMatch = fromHeader?.match(/^"?([^"<]+)"?\s*</);
  if (fromNameMatch?.[1]) {
    return fromNameMatch[1].trim();
  }

  const emailDomainMatch = fromHeader?.match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  if (emailDomainMatch?.[1]) {
    return emailDomainMatch[1].replace(/\.[A-Za-z]{2,}$/, "").replace(/[.-]/g, " ");
  }

  const subjectMatch = subject?.match(/from\s+([A-Z][A-Za-z0-9 &'/-]+)/i);
  return subjectMatch?.[1]?.trim() ?? null;
}

function parseItemSummary(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length > 4);

  const relevant = lines.filter((line) =>
    /item|product|ticket|plan|subscription|service|qty|sku|đơn hàng|sản phẩm/i.test(line),
  );

  return (relevant[0] ?? lines.find((line) => line.length <= 100) ?? null)?.slice(0, 160) ?? null;
}

export function extractOrderDetails(args: {
  subject?: string | null;
  bodyText: string;
  fromHeader?: string | null;
  receivedAt?: Date | null;
}): OrderExtractionResult {
  const combinedText = `${args.subject ?? ""}\n${args.bodyText}`.trim();
  const normalized = combinedText.toLowerCase();
  const matchedKeywords = orderKeywords.filter((keyword) => normalized.includes(keyword));
  const orderId = parseOrderId(combinedText);
  const orderDate = parseOrderDate(combinedText) ?? args.receivedAt ?? null;
  const { totalAmount, currency } = parseAmount(combinedText);
  const merchantName = parseMerchantName(args.fromHeader ?? null, args.subject ?? null);
  const customerName = parseCustomerName(combinedText);
  const orderStatus = statusPatterns.find(([pattern]) => pattern.test(combinedText))?.[1] ?? null;
  const itemSummary = parseItemSummary(args.bodyText);

  const signals = [
    matchedKeywords.length >= 2 ? 0.24 : 0,
    orderId ? 0.2 : 0,
    totalAmount ? 0.2 : 0,
    orderStatus ? 0.12 : 0,
    merchantName ? 0.08 : 0,
    itemSummary ? 0.08 : 0,
    /thank you for your order|receipt|invoice|booking confirmed|đặt hàng thành công/i.test(combinedText)
      ? 0.16
      : 0,
  ];
  const confidenceScore = Math.max(0.1, Math.min(0.18 + signals.reduce((sum, value) => sum + value, 0), 0.98));
  const confidenceLabel = confidenceFromScore(confidenceScore);
  const isOrderLike = matchedKeywords.length > 0 && confidenceScore >= 0.45;

  return {
    isOrderLike,
    orderId,
    orderDate,
    merchantName,
    customerName,
    totalAmount,
    currency,
    orderStatus,
    itemSummary,
    confidenceScore,
    confidenceLabel,
    debug: {
      matchedKeywords,
      receivedAt: args.receivedAt?.toISOString() ?? null,
      subject: args.subject ?? null,
    },
  };
}
