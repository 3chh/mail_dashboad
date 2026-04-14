import { MailboxStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseRequiredKeywords } from "@/lib/mail/query";
import { compareMailboxesByStatusDisplayNameEmail } from "@/lib/utils";

type SearchParamValue = string | string[] | undefined;
type MailboxSelectionMode = "all" | "none" | "include" | "exclude";

export type MailboxSelectionInput = {
  selectionMode?: SearchParamValue;
  mailboxId?: SearchParamValue;
  excludeMailboxId?: SearchParamValue;
};

export type ParsedMailboxSelection = {
  selectionMode?: MailboxSelectionMode;
  requestedIds: string[];
  excludedIds: string[];
};

export function parseMultiValueParam(value: SearchParamValue) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
  }

  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseMailboxSelectionMode(value: SearchParamValue) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === "all" || rawValue === "none" || rawValue === "include" || rawValue === "exclude") {
    return rawValue;
  }

  return undefined;
}

export function parseMailboxSelectionInput(input: MailboxSelectionInput): ParsedMailboxSelection {
  return {
    selectionMode: parseMailboxSelectionMode(input.selectionMode),
    requestedIds: parseMultiValueParam(input.mailboxId),
    excludedIds: parseMultiValueParam(input.excludeMailboxId),
  };
}

export function parseMailboxSelectionFromSearchParams(searchParams: URLSearchParams) {
  return parseMailboxSelectionInput({
    selectionMode: searchParams.get("selectionMode") ?? undefined,
    mailboxId: searchParams.getAll("mailboxId"),
    excludeMailboxId: searchParams.getAll("excludeMailboxId"),
  });
}

export function appendMailboxSelectionParams(searchParams: URLSearchParams, selection: ParsedMailboxSelection) {
  const effectiveMode =
    selection.selectionMode ??
    (selection.excludedIds.length > 0 ? "exclude" : selection.requestedIds.length > 0 ? "include" : undefined);

  if (!effectiveMode) {
    return;
  }

  searchParams.set("selectionMode", effectiveMode);

  if (effectiveMode === "include") {
    for (const mailboxId of selection.requestedIds) {
      searchParams.append("mailboxId", mailboxId);
    }
  }

  if (effectiveMode === "exclude") {
    for (const mailboxId of selection.excludedIds) {
      searchParams.append("excludeMailboxId", mailboxId);
    }
  }
}

export async function resolveMailboxSelection(adminUserId: string, requestedSelection: ParsedMailboxSelection) {
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
  const activeMailboxIds = mailboxes.filter((mailbox) => mailbox.status === MailboxStatus.ACTIVE).map((mailbox) => mailbox.id);
  const activeMailboxIdSet = new Set(activeMailboxIds);
  const requestedIds = requestedSelection.requestedIds.filter((id) => availableIds.has(id));
  const excludedIds = new Set(requestedSelection.excludedIds.filter((id) => activeMailboxIdSet.has(id)));

  let selectedMailboxIds: string[];

  switch (requestedSelection.selectionMode) {
    case "none":
      selectedMailboxIds = [];
      break;
    case "all":
      selectedMailboxIds = activeMailboxIds;
      break;
    case "exclude":
      selectedMailboxIds = activeMailboxIds.filter((mailboxId) => !excludedIds.has(mailboxId));
      break;
    case "include":
      selectedMailboxIds = requestedIds;
      break;
    default:
      selectedMailboxIds = requestedIds;
      break;
  }

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
