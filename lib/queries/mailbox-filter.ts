import { MailboxStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseRequiredKeywords } from "@/lib/mail/query";
import { compareMailboxesByStatusDisplayNameEmail } from "@/lib/utils";

type SearchParamValue = string | string[] | undefined;

export function parseMultiValueParam(value: SearchParamValue) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
  }

  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export async function resolveMailboxSelection(adminUserId: string, requestedIds: string[]) {
  const mailboxes = await prisma.mailbox.findMany({
    where: {
      status: {
        in: [MailboxStatus.ACTIVE, MailboxStatus.ERROR, MailboxStatus.RECONNECT_REQUIRED, MailboxStatus.PENDING_CONSENT],
      },
      OR: [{ createdById: adminUserId }, { createdById: null }],
    },
    orderBy: [{ emailAddress: "asc" }],
    select: {
      id: true,
      emailAddress: true,
      displayName: true,
      provider: true,
      status: true,
      lastSyncedAt: true,
      lastError: true,
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  mailboxes.sort(compareMailboxesByStatusDisplayNameEmail);

  const availableIds = new Set(mailboxes.map((mailbox) => mailbox.id));
  const selectedMailboxIds =
    requestedIds.length > 0
      ? requestedIds.filter((id) => availableIds.has(id))
      : mailboxes.filter((mailbox) => mailbox.status === MailboxStatus.ACTIVE).map((mailbox) => mailbox.id);

  return {
    mailboxes,
    selectedMailboxIds,
  };
}

function buildReceivedAtRange(args: { dateFrom?: string; dateTo?: string; lookbackDays?: number }) {
  let effectiveDateFrom = args.dateFrom;

  if (!effectiveDateFrom && args.lookbackDays && args.lookbackDays > 0) {
    const date = new Date();
    date.setDate(date.getDate() - args.lookbackDays);
    date.setHours(0, 0, 0, 0);
    effectiveDateFrom = date.toISOString();
  }

  if (!effectiveDateFrom && !args.dateTo) {
    return undefined;
  }

  return {
    gte: effectiveDateFrom ? new Date(effectiveDateFrom) : undefined,
    lte: args.dateTo ? new Date(`${args.dateTo}T23:59:59.999Z`) : undefined,
  };
}

export function buildMessageWhereClause(args: {
  mailboxIds: string[];
  keyword?: string;
  sender?: string;
  dateFrom?: string;
  dateTo?: string;
  unreadOnly?: boolean;
  withAttachments?: boolean;
  lookbackDays?: number;
}): Prisma.MailMessageWhereInput {
  const requiredKeywords = parseRequiredKeywords(args.keyword);

  return {
    mailboxId: {
      in: args.mailboxIds,
    },
    receivedAt: buildReceivedAtRange(args),
    OR: args.sender
      ? [
          { fromHeader: { contains: args.sender } },
          { fromEmail: { contains: args.sender } },
          { fromName: { contains: args.sender } },
        ]
      : undefined,
    hasAttachments: args.withAttachments ? true : undefined,
    labels: args.unreadOnly ? { contains: "UNREAD" } : undefined,
    AND:
      requiredKeywords.length > 0
        ? requiredKeywords.map((keyword) => ({
            OR: [
              { subject: { contains: keyword } },
              { plainTextBody: { contains: keyword } },
              { normalizedText: { contains: keyword } },
              { snippet: { contains: keyword } },
            ],
          }))
        : undefined,
  };
}
