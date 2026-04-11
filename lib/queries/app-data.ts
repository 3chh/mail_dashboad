import { prisma } from "@/lib/db/prisma";
import { extractOtpCandidates } from "@/lib/extractors/otp";
import { fetchLatestMessageForMailbox } from "@/lib/mail/service";
import {
  extractAddressLine,
  extractNumericSortValue,
  extractTrackingNumber,
  formatSearchExportDate,
  messageMatchesRequiredKeywords,
  parseSearchMode,
  resolveWarehouseMatch,
  type WarehouseLookupRow,
} from "@/lib/mail/query";
import { buildMessageWhereClause } from "@/lib/queries/mailbox-filter";
import type { NormalizedMailMessage } from "@/types/domain";

type FilterInput = {
  sender?: string;
  dateFrom?: string;
  dateTo?: string;
  unreadOnly?: boolean;
  lookbackDays?: number;
};

type SearchMailFilters = FilterInput & {
  keyword?: string;
  withAttachments?: boolean;
  mode?: string;
};

export type MailToolSearchResult = {
  id: string;
  messageId: string;
  from: string;
  name: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  snippet: string;
  tracking: string;
  address: string;
  warehouse: string;
  hasAttachments: boolean;
  labels: string | null;
  receivedAt: Date | null;
  mailbox: {
    id: string;
    emailAddress: string;
    displayName: string | null;
    provider: "GMAIL" | "OUTLOOK";
    status: string;
    lastSyncedAt: Date | null;
    lastError: string | null;
    group?: {
      id: string;
      name: string;
    } | null;
  };
};

function extractFromAddress(fromEmail: string | null, fromHeader: string | null) {
  if (fromEmail?.trim()) {
    return fromEmail.trim();
  }

  const match = fromHeader?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (match?.[0]) {
    return match[0].trim();
  }

  return fromHeader?.trim() || "N/A";
}

function resolveOtpSourceText(message: NormalizedMailMessage) {
  return (message.normalizedText || message.plainTextBody || message.snippet || "").trim();
}

export async function getOtpMonitorData(mailboxIds: string[]) {
  const mailboxes = await prisma.mailbox.findMany({
    where: {
      id: {
        in: mailboxIds,
      },
    },
  });

  const mailboxById = new Map(mailboxes.map((mailbox) => [mailbox.id, mailbox]));

  const results = await Promise.all(
    mailboxIds.map(async (mailboxId) => {
      const mailbox = mailboxById.get(mailboxId) ?? null;

      if (!mailbox) {
        return {
          id: `${mailboxId}-missing`,
          mailbox: null,
          message: null,
          latestCandidate: null,
          candidateCount: 0,
          errorMessage: "Mailbox không tồn tại hoặc không còn quyền truy cập.",
        };
      }

      try {
        const message = await fetchLatestMessageForMailbox({
          mailbox,
        });

        if (!message) {
          return {
            id: `${mailboxId}-empty`,
            mailbox,
            message: null,
            latestCandidate: null,
            candidateCount: 0,
            errorMessage: null,
          };
        }

        const candidates = extractOtpCandidates({
          subject: message.subject,
          bodyText: resolveOtpSourceText(message),
          fromHeader: message.fromHeader,
        });

        return {
          id: `${mailboxId}-${message.remoteMessageId}`,
          mailbox,
          message,
          latestCandidate: candidates[0] ?? null,
          candidateCount: candidates.length,
          errorMessage: null,
        };
      } catch (error) {
        return {
          id: `${mailboxId}-error`,
          mailbox,
          message: null,
          latestCandidate: null,
          candidateCount: 0,
          errorMessage: error instanceof Error ? error.message : "Không thể lấy mail mới nhất từ provider.",
        };
      }
    }),
  );

  return results;
}

export async function getOrdersData(mailboxIds: string[], filters: FilterInput & { merchant?: string }) {
  return prisma.orderExtraction.findMany({
    where: {
      message: buildMessageWhereClause({
        mailboxIds,
        sender: filters.sender,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        unreadOnly: filters.unreadOnly,
        lookbackDays: filters.lookbackDays,
      }),
      merchantName: filters.merchant
        ? {
          contains: filters.merchant,
        }
        : undefined,
    },
    include: {
      message: {
        include: {
          mailbox: true,
        },
      },
    },
    orderBy: [{ confidenceScore: "desc" }, { receivedAt: "desc" }],
    take: 200,
  });
}

async function loadWarehousesForSearch(adminUserId?: string): Promise<WarehouseLookupRow[]> {
  const warehouses = await prisma.warehouse.findMany({
    where: adminUserId
      ? {
        OR: [{ createdById: adminUserId }, { createdById: null }],
      }
      : undefined,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      address: true,
      normalizedAddress: true,
    },
  });

  return warehouses;
}

export async function searchMailToolResults(mailboxIds: string[], filters: SearchMailFilters, adminUserId?: string) {
  const mode = parseSearchMode(filters.mode);
  const [messages, warehouses] = await Promise.all([
    prisma.$transaction(
      mailboxIds.map((mailboxId) =>
        prisma.mailMessage.findFirst({
          where: buildMessageWhereClause({
            mailboxIds: [mailboxId],
            keyword: filters.keyword,
            sender: filters.sender,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            unreadOnly: filters.unreadOnly,
            withAttachments: filters.withAttachments,
            lookbackDays: filters.lookbackDays,
          }),
          select: {
            id: true,
            fromEmail: true,
            fromHeader: true,
            subject: true,
            snippet: true,
            receivedAt: true,
            plainTextBody: true,
            normalizedText: true,
            hasAttachments: true,
            labels: true,
            mailbox: {
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
            },
          },
          orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        }),
      ),
    ),
    mode === "order" ? loadWarehousesForSearch(adminUserId) : Promise.resolve([]),
  ]);

  return messages
    .filter((message): message is NonNullable<(typeof messages)[number]> => Boolean(message))
    .filter((message) =>
      messageMatchesRequiredKeywords(
        [message.subject, message.plainTextBody, message.normalizedText, message.snippet],
        filters.keyword,
      ),
    )
    .map((message) => {
      const body = (message.plainTextBody || message.normalizedText || message.snippet || "").trim();
      const warehouseMatch =
        mode === "order"
          ? resolveWarehouseMatch(body, warehouses)
          : {
            address: extractAddressLine(body),
            warehouse: "N/A",
            score: 0,
          };

      const result: MailToolSearchResult = {
        id: `${message.mailbox.id}-${message.id}`,
        messageId: message.id,
        from: extractFromAddress(message.fromEmail, message.fromHeader),
        name: message.mailbox.displayName?.trim() || "N/A",
        to: message.mailbox.emailAddress,
        date: formatSearchExportDate(message.receivedAt),
        subject: message.subject?.trim() || "",
        body,
        snippet: (message.snippet || body).trim(),
        tracking: mode === "order" ? extractTrackingNumber(body) : "N/A",
        address: mode === "order" ? warehouseMatch.address : "N/A",
        warehouse: mode === "order" ? warehouseMatch.warehouse : "N/A",
        hasAttachments: message.hasAttachments,
        labels: message.labels,
        receivedAt: message.receivedAt,
        mailbox: message.mailbox,
      };

      return result;
    })
    .sort((left, right) => {
      const numericCompare = extractNumericSortValue(left.name) - extractNumericSortValue(right.name);
      if (numericCompare !== 0) {
        return numericCompare;
      }

      return left.to.localeCompare(right.to);
    });
}

export async function getScanJobsData(adminUserId: string) {
  return prisma.scanJob.findMany({
    where: {
      OR: [{ adminUserId }, { adminUserId: null }],
    },
    include: {
      mailbox: true,
      logs: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function getSettingsData(adminUserId: string) {
  const [adminUser, totals] = await Promise.all([
    prisma.adminUser.findUnique({
      where: { id: adminUserId },
    }),
    prisma.$transaction([
      prisma.mailbox.count({
        where: {
          OR: [{ createdById: adminUserId }, { createdById: null }],
        },
      }),
      prisma.mailMessage.count({
        where: {
          mailbox: {
            OR: [{ createdById: adminUserId }, { createdById: null }],
          },
        },
      }),
      prisma.otpDetection.count({
        where: {
          message: {
            mailbox: {
              OR: [{ createdById: adminUserId }, { createdById: null }],
            },
          },
        },
      }),
      prisma.orderExtraction.count({
        where: {
          message: {
            mailbox: {
              OR: [{ createdById: adminUserId }, { createdById: null }],
            },
          },
        },
      }),
    ]),
  ]);

  return {
    adminUser,
    totals: {
      mailboxes: totals[0],
      messages: totals[1],
      otps: totals[2],
      orders: totals[3],
    },
  };
}

export async function getMessageDetailData(messageId: string) {
  const message = await prisma.mailMessage.findUnique({
    where: {
      id: messageId,
    },
    include: {
      mailbox: true,
    },
  });

  if (!message) {
    throw new Error("Không tìm thấy email.");
  }

  const [otpDetections, orderExtraction] = await Promise.all([
    prisma.otpDetection.findMany({
      where: {
        messageId: message.id,
      },
      orderBy: [{ confidenceScore: "desc" }, { detectedAt: "desc" }],
    }),
    prisma.orderExtraction.findUnique({
      where: {
        messageId: message.id,
      },
    }),
  ]);

  return {
    message,
    otpDetections,
    orderExtraction,
  };
}
