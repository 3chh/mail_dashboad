import { MailProvider, MailboxStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getGmailMessage, listGmailMessageRefs } from "@/lib/mail/adapters/gmail-api";
import { getMicrosoftMessage, listMicrosoftMessageRefs } from "@/lib/mail/adapters/microsoft-graph";
import { extractOtpCandidates } from "@/lib/extractors/otp";
import type { NormalizedMailMessage, OtpCandidate } from "@/types/domain";

const mailboxIdentitySelect = {
  id: true,
  emailAddress: true,
  displayName: true,
  provider: true,
  authType: true,
  status: true,
  externalUserId: true,
  accessTokenEncrypted: true,
  refreshTokenEncrypted: true,
  tokenExpiresAt: true,
  grantedScopes: true,
  consentedAt: true,
  lastSyncedAt: true,
  lastSyncCursor: true,
  lastError: true,
  notes: true,
  groupId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MailboxSelect;

export type ManagedMailbox = Prisma.MailboxGetPayload<{
  select: typeof mailboxIdentitySelect;
}>;

export async function getMailboxForAdmin(mailboxId: string, adminUserId: string) {
  return prisma.mailbox.findFirst({
    where: {
      id: mailboxId,
      OR: [{ createdById: adminUserId }, { createdById: null }],
    },
    select: mailboxIdentitySelect,
  });
}

export async function listManagedMailboxes(adminUserId: string) {
  return prisma.mailbox.findMany({
    where: {
      OR: [{ createdById: adminUserId }, { createdById: null }],
    },
    orderBy: [{ status: "asc" }, { emailAddress: "asc" }],
    select: mailboxIdentitySelect,
  });
}

export async function listActiveMailboxIds(adminUserId: string) {
  const mailboxes = await prisma.mailbox.findMany({
    where: {
      status: MailboxStatus.ACTIVE,
      OR: [{ createdById: adminUserId }, { createdById: null }],
    },
    select: {
      id: true,
    },
  });

  return mailboxes.map((mailbox) => mailbox.id);
}

export async function listMessageRefsForMailbox(args: {
  mailbox: ManagedMailbox;
  lookbackDays?: number;
  maxResults: number;
  folder?: "inbox" | "junkemail";
}) {
  if (args.mailbox.provider === MailProvider.GMAIL) {
    return listGmailMessageRefs(args);
  }

  return listMicrosoftMessageRefs(args);
}

export async function fetchAndParseMessage(args: {
  mailbox: ManagedMailbox;
  remoteMessageId: string;
}) {
  if (args.mailbox.provider === MailProvider.GMAIL) {
    return getGmailMessage(args);
  }

  return getMicrosoftMessage(args);
}

export async function fetchLatestMessageForMailbox(args: {
  mailbox: ManagedMailbox;
}) {
  const result = await listMessageRefsForMailbox({
    mailbox: args.mailbox,
    maxResults: 1,
  });
  const latestMessageId = result.refs.find((ref) => ref.remoteId)?.remoteId;

  if (!latestMessageId) {
    return null;
  }

  return fetchAndParseMessage({
    mailbox: args.mailbox,
    remoteMessageId: latestMessageId,
  });
}

type OtpScanMatch = {
  message: NormalizedMailMessage | null;
  candidates: OtpCandidate[];
  folder: "INBOX" | "JUNK";
};

async function scanRefsForOtp(
  mailbox: ManagedMailbox,
  refs: Array<{ remoteId: string }>,
  folder: "INBOX" | "JUNK",
  onFirstMessage?: (msg: NormalizedMailMessage) => void,
): Promise<{ bestHighOrMedium: OtpScanMatch | null; bestLow: OtpScanMatch | null }> {
  let bestLow: OtpScanMatch | null = null;
  let reportedFirst = false;

  for (let i = 0; i < refs.length; i++) {
    const remoteId = refs[i].remoteId;
    try {
      const message = await fetchAndParseMessage({
        mailbox,
        remoteMessageId: remoteId,
      });

      if (!message) continue;
      if (onFirstMessage && !reportedFirst) {
        reportedFirst = true;
        onFirstMessage(message);
      }

      // Do not duplicate subject in sourceText since subject is already passed explicitly
      const sourceText = [message.snippet, message.normalizedText, message.plainTextBody]
        .filter(Boolean)
        .join("\n")
        .trim();

      const candidates = extractOtpCandidates({
        subject: message.subject,
        bodyText: sourceText,
        fromHeader: message.fromHeader,
      });

      if (candidates.length > 0) {
        const topCandidate = candidates[0];
        // Stop scanning immediately only if confidence is MEDIUM or HIGH
        if (topCandidate.confidenceLabel !== "LOW") {
          return {
            bestHighOrMedium: { message, candidates, folder },
            bestLow,
          };
        } else if (!bestLow) {
          bestLow = { message, candidates, folder };
        }
      }
    } catch {
      // Continue scanning next message
    }
  }

  return { bestHighOrMedium: null, bestLow };
}

export async function fetchRecentOtpMessageForMailbox(args: {
  mailbox: ManagedMailbox;
  maxScan?: number;
}): Promise<OtpScanMatch> {
  const maxScan = args.maxScan ?? 10;
  let firstInboxMessage: NormalizedMailMessage | null = null;

  // 1. Scan recent messages from inbox (up to maxScan)
  const inboxResult = await listMessageRefsForMailbox({
    mailbox: args.mailbox,
    maxResults: maxScan,
    folder: "inbox",
  });

  const inboxRefs = inboxResult.refs.filter((ref) => Boolean(ref.remoteId));
  const inboxScan = await scanRefsForOtp(
    args.mailbox,
    inboxRefs,
    "INBOX",
    (first) => { firstInboxMessage = first; },
  );

  if (inboxScan.bestHighOrMedium) {
    return inboxScan.bestHighOrMedium;
  }

  // 2. Fallback: check Junk / Spam folder (top 3 messages)
  try {
    const junkResult = await listMessageRefsForMailbox({
      mailbox: args.mailbox,
      maxResults: 3,
      folder: "junkemail",
    });

    const junkRefs = junkResult.refs.filter((ref) => Boolean(ref.remoteId));
    const junkScan = await scanRefsForOtp(args.mailbox, junkRefs, "JUNK");

    if (junkScan.bestHighOrMedium) {
      return junkScan.bestHighOrMedium;
    }

    // If a LOW candidate was found anywhere (inbox or junk), use it over nothing
    if (inboxScan.bestLow) {
      return inboxScan.bestLow;
    }
    if (junkScan.bestLow) {
      return junkScan.bestLow;
    }
  } catch {
    // Ignore junk scan failure
  }

  // 3. Fallback: return the first (most recent) inbox message with empty candidates
  return {
    message: firstInboxMessage,
    candidates: [] as OtpCandidate[],
    folder: "INBOX" as const,
  };
}

export async function upsertParsedMessage(args: {
  mailboxId: string;
  message: NormalizedMailMessage;
  scanJobId?: string;
}) {
  const parsed = args.message;

  return prisma.mailMessage.upsert({
    where: {
      mailboxId_remoteMessageId: {
        mailboxId: args.mailboxId,
        remoteMessageId: parsed.remoteMessageId,
      },
    },
    update: {
      scanJobId: args.scanJobId,
      provider: parsed.provider,
      remoteThreadId: parsed.remoteThreadId,
      fromName: parsed.fromName,
      fromEmail: parsed.fromEmail,
      fromHeader: parsed.fromHeader,
      subject: parsed.subject,
      snippet: parsed.snippet,
      receivedAt: parsed.receivedAt,
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
      mailboxId: args.mailboxId,
      scanJobId: args.scanJobId,
      provider: parsed.provider,
      remoteMessageId: parsed.remoteMessageId,
      remoteThreadId: parsed.remoteThreadId,
      fromName: parsed.fromName,
      fromEmail: parsed.fromEmail,
      fromHeader: parsed.fromHeader,
      subject: parsed.subject,
      snippet: parsed.snippet,
      receivedAt: parsed.receivedAt,
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

export async function getStoredMessage(messageId: string) {
  return prisma.mailMessage.findUnique({
    where: {
      id: messageId,
    },
    include: {
      mailbox: true,
    },
  });
}
