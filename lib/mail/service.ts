import { MailProvider, MailboxStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getGmailMessage, listGmailMessageRefs } from "@/lib/mail/adapters/gmail-api";
import { getMicrosoftMessage, listMicrosoftMessageRefs } from "@/lib/mail/adapters/microsoft-graph";
import type { NormalizedMailMessage } from "@/types/domain";

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
