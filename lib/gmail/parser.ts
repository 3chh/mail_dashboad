import { convert } from "html-to-text";
import type { gmail_v1 } from "googleapis";
import type { ParsedBodyPart, ParsedGmailMessage } from "@/types/domain";

function decodeBase64Url(data?: string | null) {
  if (!data) {
    return "";
  }

  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function getHeaderValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function parseAddress(fromHeader: string | null) {
  if (!fromHeader) {
    return {
      fromName: null,
      fromEmail: null,
    };
  }

  const match = fromHeader.match(/^(?:"?([^"]*)"?\s)?<?([^<>@\s]+@[^<>]+)>?$/);
  if (!match) {
    return {
      fromName: null,
      fromEmail: fromHeader,
    };
  }

  const [, rawName, email] = match;
  return {
    fromName: rawName?.trim() || null,
    fromEmail: email?.trim() || null,
  };
}

function collectParts(
  part: gmail_v1.Schema$MessagePart | undefined,
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
    collectParts(child, bucket, attachments);
  }
}

export function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedGmailMessage {
  const headers = message.payload?.headers ?? [];
  const fromHeader = getHeaderValue(headers, "From");
  const subject = getHeaderValue(headers, "Subject");
  const internalDate = message.internalDate
    ? new Date(Number(message.internalDate))
    : null;

  const parts: ParsedBodyPart[] = [];
  const hasAttachments = { value: false };
  collectParts(message.payload, parts, hasAttachments);

  const plainTextBody =
    parts.find((part) => part.mimeType === "text/plain")?.content ||
    decodeBase64Url(message.payload?.body?.data) ||
    null;
  const htmlBody = parts.find((part) => part.mimeType === "text/html")?.content ?? null;
  const normalizedText = (plainTextBody ||
    (htmlBody
      ? convert(htmlBody, {
          wordwrap: false,
          selectors: [{ selector: "a", options: { hideLinkHrefIfSameAsText: true } }],
        })
      : "") ||
    message.snippet ||
    "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const { fromName, fromEmail } = parseAddress(fromHeader);

  return {
    gmailMessageId: message.id ?? "",
    threadId: message.threadId ?? "",
    fromHeader: fromHeader ?? "",
    fromName,
    fromEmail,
    subject,
    snippet: message.snippet ?? null,
    internalDate,
    plainTextBody,
    htmlBody,
    normalizedText,
    labels: message.labelIds ?? [],
    hasAttachments: hasAttachments.value,
    sizeEstimate: message.sizeEstimate ?? null,
    rawHeadersJson: JSON.stringify(headers),
    rawPayloadJson: JSON.stringify(message.payload ?? {}),
    payload: message.payload,
  };
}
