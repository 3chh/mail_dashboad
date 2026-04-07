import { convert } from "html-to-text";
import { MailProvider } from "@prisma/client";
import type { ParsedBodyPart, NormalizedMailMessage } from "@/types/domain";

function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function htmlToPlainText(value: string) {
  return convert(value, {
    wordwrap: false,
    selectors: [{ selector: "a", options: { hideLinkHrefIfSameAsText: true } }],
  });
}

function parseAddress(header: string | null) {
  if (!header) {
    return {
      fromName: null,
      fromEmail: null,
    };
  }

  const match = header.match(/^(?:"?([^"]*)"?\s)?<?([^<>@\s]+@[^<>]+)>?$/);
  if (!match) {
    return {
      fromName: null,
      fromEmail: header,
    };
  }

  const [, rawName, email] = match;
  return {
    fromName: rawName?.trim() || null,
    fromEmail: email?.trim() || null,
  };
}

function decodeBase64Url(data?: string | null) {
  if (!data) {
    return "";
  }

  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function collectGmailParts(
  part: {
    mimeType?: string | null;
    filename?: string | null;
    body?: { data?: string | null } | null;
    parts?: unknown[] | null;
  } | null | undefined,
  bucket: ParsedBodyPart[],
  attachments: { value: boolean },
) {
  if (!part) {
    return;
  }

  if (part.filename) {
    attachments.value = true;
  }

  if (part.mimeType === "text/plain" || part.mimeType === "text/html") {
    bucket.push({
      mimeType: part.mimeType,
      content: decodeBase64Url(part.body?.data),
    });
  }

  for (const child of part.parts ?? []) {
    collectGmailParts(child as Parameters<typeof collectGmailParts>[0], bucket, attachments);
  }
}

export function parseGmailApiMessage(message: {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  internalDate?: string | null;
  sizeEstimate?: number | null;
  labelIds?: string[] | null;
  payload?: {
    headers?: Array<{ name?: string | null; value?: string | null }> | null;
    body?: { data?: string | null } | null;
    parts?: unknown[] | null;
  } | null;
}): NormalizedMailMessage {
  const headers = message.payload?.headers ?? [];
  const fromHeader =
    headers.find((header) => header.name?.toLowerCase() === "from")?.value ?? "";
  const subject =
    headers.find((header) => header.name?.toLowerCase() === "subject")?.value ?? null;
  const receivedAt = message.internalDate ? new Date(Number(message.internalDate)) : null;

  const parts: ParsedBodyPart[] = [];
  const attachments = { value: false };
  collectGmailParts(message.payload, parts, attachments);

  const plainTextBody =
    parts.find((part) => part.mimeType === "text/plain")?.content ||
    decodeBase64Url(message.payload?.body?.data) ||
    null;
  const htmlBody = parts.find((part) => part.mimeType === "text/html")?.content ?? null;
  const normalizedText = normalizeWhitespace(
    plainTextBody || (htmlBody ? htmlToPlainText(htmlBody) : "") || message.snippet || "",
  );
  const { fromName, fromEmail } = parseAddress(fromHeader);

  return {
    provider: MailProvider.GMAIL,
    remoteMessageId: message.id ?? "",
    remoteThreadId: message.threadId ?? null,
    fromHeader,
    fromName,
    fromEmail,
    subject,
    snippet: message.snippet ?? null,
    receivedAt,
    plainTextBody,
    htmlBody,
    normalizedText,
    labels: message.labelIds ?? [],
    hasAttachments: attachments.value,
    sizeEstimate: message.sizeEstimate ?? null,
    rawHeadersJson: JSON.stringify(headers),
    rawPayloadJson: JSON.stringify(message.payload ?? {}),
  };
}

export function parseMicrosoftGraphMessage(message: {
  id?: string | null;
  conversationId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  hasAttachments?: boolean | null;
  isRead?: boolean | null;
  categories?: string[] | null;
  from?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  } | null;
  body?: {
    contentType?: string | null;
    content?: string | null;
  } | null;
  internetMessageHeaders?: Array<{ name?: string | null; value?: string | null }> | null;
}): NormalizedMailMessage {
  const fromName = message.from?.emailAddress?.name?.trim() || null;
  const fromEmail = message.from?.emailAddress?.address?.trim() || null;
  const fromHeader =
    fromName && fromEmail ? `${fromName} <${fromEmail}>` : fromEmail ?? fromName ?? "";
  const htmlBody =
    message.body?.contentType?.toLowerCase() === "html" ? message.body.content ?? null : null;
  const plainTextBody =
    message.body?.contentType?.toLowerCase() === "text" ? message.body.content ?? null : null;
  const normalizedText = normalizeWhitespace(
    plainTextBody || (htmlBody ? htmlToPlainText(htmlBody) : "") || message.bodyPreview || "",
  );
  const labels = [
    ...(message.categories ?? []),
    ...(message.isRead === false ? ["UNREAD"] : []),
  ];

  return {
    provider: MailProvider.OUTLOOK,
    remoteMessageId: message.id ?? "",
    remoteThreadId: message.conversationId ?? null,
    fromHeader,
    fromName,
    fromEmail,
    subject: message.subject ?? null,
    snippet: message.bodyPreview ?? null,
    receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : null,
    plainTextBody,
    htmlBody,
    normalizedText,
    labels,
    hasAttachments: message.hasAttachments ?? false,
    sizeEstimate: null,
    rawHeadersJson: JSON.stringify(message.internetMessageHeaders ?? []),
    rawPayloadJson: JSON.stringify(message),
  };
}
