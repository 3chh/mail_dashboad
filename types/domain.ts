import type { ConfidenceLabel, MailProvider } from "@prisma/client";

export type ParsedBodyPart = {
  mimeType: string;
  content: string;
};

export type NormalizedMailMessage = {
  provider: MailProvider;
  remoteMessageId: string;
  remoteThreadId: string | null;
  fromHeader: string;
  fromName: string | null;
  fromEmail: string | null;
  subject: string | null;
  snippet: string | null;
  receivedAt: Date | null;
  plainTextBody: string | null;
  htmlBody: string | null;
  normalizedText: string;
  labels: string[];
  hasAttachments: boolean;
  sizeEstimate: number | null;
  rawHeadersJson: string;
  rawPayloadJson: string;
};

export type OtpCandidate = {
  code: string;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  matchedKeywords: string[];
  contextSnippet: string;
};

export type OrderExtractionResult = {
  isOrderLike: boolean;
  orderId: string | null;
  orderDate: Date | null;
  merchantName: string | null;
  customerName: string | null;
  totalAmount: number | null;
  currency: string | null;
  orderStatus: string | null;
  itemSummary: string | null;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  debug: Record<string, unknown>;
};
