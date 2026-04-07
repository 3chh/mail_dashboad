import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { prisma } from "@/lib/db/prisma";
import { getGoogleAuthClientForUser } from "@/lib/gmail/oauth";
import { parseGmailMessage } from "@/lib/gmail/parser";
import type { ParsedGmailMessage } from "@/types/domain";

export type GmailListResult = {
  messages: gmail_v1.Schema$Message[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
};

function mapGmailError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/insufficient authentication scopes/i.test(message)) {
    return new Error(
      "Tài khoản Google hiện chưa cấp quyền đọc Gmail. Vào Cài đặt, bấm 'Kết nối lại tài khoản Google', rồi chấp nhận quyền Gmail.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

async function getGmailClient(userId: string) {
  const auth = await getGoogleAuthClientForUser(userId);
  return google.gmail({ version: "v1", auth });
}

export async function listMessagesForQuery(args: {
  userId: string;
  query: string;
  pageToken?: string;
  maxResults?: number;
}) {
  try {
    const gmail = await getGmailClient(args.userId);
    const response = await gmail.users.messages.list({
      userId: "me",
      q: args.query,
      maxResults: args.maxResults ?? 20,
      pageToken: args.pageToken,
    });

    return {
      messages: response.data.messages ?? [],
      nextPageToken: response.data.nextPageToken ?? null,
      resultSizeEstimate: response.data.resultSizeEstimate ?? 0,
    } satisfies GmailListResult;
  } catch (error) {
    throw mapGmailError(error);
  }
}

export async function getMessageDetails(args: { userId: string; gmailMessageId: string }) {
  try {
    const gmail = await getGmailClient(args.userId);
    const response = await gmail.users.messages.get({
      userId: "me",
      id: args.gmailMessageId,
      format: "full",
    });

    return response.data;
  } catch (error) {
    throw mapGmailError(error);
  }
}

export async function fetchAndParseMessage(args: {
  userId: string;
  gmailMessageId: string;
}) {
  const message = await getMessageDetails(args);
  return parseGmailMessage(message);
}

export async function upsertParsedMessage(args: {
  userId: string;
  message: ParsedGmailMessage;
  scanJobId?: string;
}) {
  const parsed = args.message;

  return prisma.gmailMessage.upsert({
    where: {
      userId_gmailMessageId: {
        userId: args.userId,
        gmailMessageId: parsed.gmailMessageId,
      },
    },
    update: {
      scanJobId: args.scanJobId,
      threadId: parsed.threadId,
      fromName: parsed.fromName,
      fromEmail: parsed.fromEmail,
      fromHeader: parsed.fromHeader,
      subject: parsed.subject,
      snippet: parsed.snippet,
      internalDate: parsed.internalDate,
      plainTextBody: parsed.plainTextBody,
      htmlBody: parsed.htmlBody,
      normalizedText: parsed.normalizedText,
      labels: parsed.labels.join(","),
      hasAttachments: parsed.hasAttachments,
      sizeEstimate: parsed.sizeEstimate,
      rawHeadersJson: parsed.rawHeadersJson,
      rawPayloadJson: parsed.rawPayloadJson,
    },
    create: {
      userId: args.userId,
      scanJobId: args.scanJobId,
      gmailMessageId: parsed.gmailMessageId,
      threadId: parsed.threadId,
      fromName: parsed.fromName,
      fromEmail: parsed.fromEmail,
      fromHeader: parsed.fromHeader,
      subject: parsed.subject,
      snippet: parsed.snippet,
      internalDate: parsed.internalDate,
      plainTextBody: parsed.plainTextBody,
      htmlBody: parsed.htmlBody,
      normalizedText: parsed.normalizedText,
      labels: parsed.labels.join(","),
      hasAttachments: parsed.hasAttachments,
      sizeEstimate: parsed.sizeEstimate,
      rawHeadersJson: parsed.rawHeadersJson,
      rawPayloadJson: parsed.rawPayloadJson,
    },
  });
}

export async function getStoredOrFetchMessage(args: {
  userId: string;
  gmailMessageId: string;
}) {
  const existing = await prisma.gmailMessage.findUnique({
    where: {
      userId_gmailMessageId: {
        userId: args.userId,
        gmailMessageId: args.gmailMessageId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  const parsed = await fetchAndParseMessage(args);
  return upsertParsedMessage({
    userId: args.userId,
    message: parsed,
  });
}
