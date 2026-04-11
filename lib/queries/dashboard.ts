import { subDays } from "date-fns";
import { MailboxStatus, ScanJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { compareMailboxesByStatusDisplayNameEmail } from "@/lib/utils";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fillDailySeries(records: Array<{ date: string; value: number }>, days = 14) {
  const map = new Map(records.map((record) => [record.date, record.value]));
  const series = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = subDays(new Date(), index);
    const key = dayKey(date);
    series.push({
      date: key,
      value: map.get(key) ?? 0,
    });
  }

  return series;
}

function deriveBatchStatus(statuses: ScanJobStatus[]) {
  if (statuses.some((status) => status === "RUNNING")) {
    return "RUNNING";
  }

  if (statuses.some((status) => status === "QUEUED")) {
    return "QUEUED";
  }

  if (statuses.some((status) => status === "FAILED")) {
    return "FAILED";
  }

  return "COMPLETED";
}

function formatRecentSyncTitle(run: {
  status: ScanJobStatus;
  totalSavedCount: number;
  completedMailboxCount: number;
  totalMailboxCount: number;
}) {
  if (run.status === "RUNNING") {
    return `Đang đồng bộ ${run.completedMailboxCount}/${run.totalMailboxCount} mailbox`;
  }

  if (run.status === "QUEUED") {
    return `Đã xếp lịch đồng bộ ${run.totalMailboxCount} mailbox`;
  }

  if (run.status === "COMPLETED") {
    return `Đồng bộ thành công ${run.totalSavedCount} email`;
  }

  return `Đồng bộ hoàn tất ${run.totalSavedCount} email`;
}

function formatRecentSyncDescription(run: {
  jobName: string | null;
  completedMailboxCount: number;
  totalMailboxCount: number;
  successMailboxCount: number;
  failedMailboxCount: number;
}) {
  const jobLabel = run.jobName ?? "Lượt đồng bộ";

  if (run.completedMailboxCount < run.totalMailboxCount) {
    return `${jobLabel} - ${run.completedMailboxCount}/${run.totalMailboxCount} mailbox đã xong`;
  }

  if (run.failedMailboxCount > 0) {
    return `${jobLabel} - ${run.successMailboxCount} thành công, ${run.failedMailboxCount} lỗi`;
  }

  return `${jobLabel} - ${run.successMailboxCount}/${run.totalMailboxCount} mailbox thành công`;
}

function buildRecentSyncActivity(
  jobs: Array<{
    id: string;
    batchId: string | null;
    jobName: string | null;
    status: ScanJobStatus;
    createdAt: Date;
    completedAt: Date | null;
    savedCount: number;
  }>,
) {
  const groupedRuns = new Map<
    string,
    {
      id: string;
      batchId: string | null;
      jobName: string | null;
      createdAt: Date;
      completedAt: Date | null;
      totalMailboxCount: number;
      completedMailboxCount: number;
      successMailboxCount: number;
      failedMailboxCount: number;
      totalSavedCount: number;
      statuses: ScanJobStatus[];
    }
  >();

  for (const job of jobs) {
    const groupKey = job.batchId ?? job.id;
    const current = groupedRuns.get(groupKey);

    if (!current) {
      groupedRuns.set(groupKey, {
        id: groupKey,
        batchId: job.batchId,
        jobName: job.jobName,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        totalMailboxCount: 1,
        completedMailboxCount: job.status === "COMPLETED" || job.status === "FAILED" ? 1 : 0,
        successMailboxCount: job.status === "COMPLETED" ? 1 : 0,
        failedMailboxCount: job.status === "FAILED" ? 1 : 0,
        totalSavedCount: job.savedCount,
        statuses: [job.status],
      });
      continue;
    }

    current.createdAt = current.createdAt.getTime() > job.createdAt.getTime() ? job.createdAt : current.createdAt;
    current.completedAt =
      !current.completedAt || (job.completedAt && job.completedAt.getTime() > current.completedAt.getTime()) ? (job.completedAt ?? current.completedAt) : current.completedAt;
    current.totalMailboxCount += 1;
    current.completedMailboxCount += job.status === "COMPLETED" || job.status === "FAILED" ? 1 : 0;
    current.successMailboxCount += job.status === "COMPLETED" ? 1 : 0;
    current.failedMailboxCount += job.status === "FAILED" ? 1 : 0;
    current.totalSavedCount += job.savedCount;
    current.statuses.push(job.status);
  }

  return [...groupedRuns.values()]
    .map((run) => {
      const status = deriveBatchStatus(run.statuses);

      return {
        id: run.id,
        type: "sync" as const,
        title: formatRecentSyncTitle({
          status,
          totalSavedCount: run.totalSavedCount,
          completedMailboxCount: run.completedMailboxCount,
          totalMailboxCount: run.totalMailboxCount,
        }),
        description: formatRecentSyncDescription(run),
        timestamp: run.completedAt ?? run.createdAt,
      };
    })
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
    .slice(0, 6);
}

export async function getDashboardData(adminUserId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since14Days = subDays(new Date(), 13);

  const mailboxWhere = {
    OR: [{ createdById: adminUserId }, { createdById: null }],
  };
  const sharedVisibilityWhere = {
    OR: [{ createdById: adminUserId }, { createdById: null }],
  };

  const [
    mailboxes,
    mailboxGroups,
    totalMessages,
    syncedToday,
    otpsFound,
    ordersFound,
    recentJobs,
    recentOtps,
    recentOrders,
    messagesByDay,
    otpsByDay,
    ordersByDay,
  ] = await Promise.all([
    prisma.mailbox.findMany({
      where: mailboxWhere,
      orderBy: [{ status: "asc" }, { emailAddress: "asc" }],
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            messages: true,
            scanJobs: true,
          },
        },
      },
    }),
    prisma.mailboxGroup.findMany({
      where: sharedVisibilityWhere,
      orderBy: [{ name: "asc" }],
      include: {
        _count: {
          select: {
            mailboxes: true,
          },
        },
      },
    }),
    prisma.mailMessage.count({
      where: {
        mailbox: mailboxWhere,
      },
    }),
    prisma.mailMessage.count({
      where: {
        mailbox: mailboxWhere,
        createdAt: {
          gte: todayStart,
        },
      },
    }),
    prisma.otpDetection.count({
      where: {
        message: {
          mailbox: mailboxWhere,
        },
      },
    }),
    prisma.orderExtraction.count({
      where: {
        message: {
          mailbox: mailboxWhere,
        },
      },
    }),
    prisma.scanJob.findMany({
      where: {
        mailbox: mailboxWhere,
      },
      select: {
        id: true,
        batchId: true,
        jobName: true,
        status: true,
        createdAt: true,
        completedAt: true,
        savedCount: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.otpDetection.findMany({
      where: {
        message: {
          mailbox: mailboxWhere,
        },
      },
      include: {
        message: {
          include: {
            mailbox: true,
          },
        },
      },
      orderBy: { detectedAt: "desc" },
      take: 6,
    }),
    prisma.orderExtraction.findMany({
      where: {
        message: {
          mailbox: mailboxWhere,
        },
      },
      include: {
        message: {
          include: {
            mailbox: true,
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: 6,
    }),
    prisma.mailMessage.findMany({
      where: {
        mailbox: mailboxWhere,
        receivedAt: {
          gte: since14Days,
        },
      },
      select: {
        receivedAt: true,
      },
    }),
    prisma.otpDetection.findMany({
      where: {
        message: {
          mailbox: mailboxWhere,
        },
        detectedAt: {
          gte: since14Days,
        },
      },
      select: {
        detectedAt: true,
      },
    }),
    prisma.orderExtraction.findMany({
      where: {
        message: {
          mailbox: mailboxWhere,
        },
        receivedAt: {
          gte: since14Days,
        },
      },
      select: {
        receivedAt: true,
      },
    }),
  ]);

  const activeMailboxCount = mailboxes.filter((mailbox) => mailbox.status === MailboxStatus.ACTIVE).length;
  const reconnectRequiredCount = mailboxes.filter((mailbox) => mailbox.status === MailboxStatus.RECONNECT_REQUIRED).length;
  const errorMailboxCount = mailboxes.filter((mailbox) => mailbox.status === MailboxStatus.ERROR).length;

  return {
    stats: {
      mailboxCount: mailboxes.length,
      activeMailboxCount,
      reconnectRequiredCount,
      errorMailboxCount,
      totalMessages,
      syncedToday,
      otpsFound,
      ordersFound,
    },
    groups: mailboxGroups.map((group) => ({
      id: group.id,
      name: group.name,
      mailboxCount: group._count.mailboxes,
    })),
    charts: {
      emailsByDay: fillDailySeries(
        Object.entries(
          messagesByDay.reduce<Record<string, number>>((accumulator, message) => {
            if (!message.receivedAt) {
              return accumulator;
            }

            const key = dayKey(message.receivedAt);
            accumulator[key] = (accumulator[key] ?? 0) + 1;
            return accumulator;
          }, {}),
        ).map(([date, value]) => ({ date, value })),
      ),
      otpsByDay: fillDailySeries(
        Object.entries(
          otpsByDay.reduce<Record<string, number>>((accumulator, detection) => {
            const key = dayKey(detection.detectedAt);
            accumulator[key] = (accumulator[key] ?? 0) + 1;
            return accumulator;
          }, {}),
        ).map(([date, value]) => ({ date, value })),
      ),
      ordersByDay: fillDailySeries(
        Object.entries(
          ordersByDay.reduce<Record<string, number>>((accumulator, order) => {
            if (!order.receivedAt) {
              return accumulator;
            }

            const key = dayKey(order.receivedAt);
            accumulator[key] = (accumulator[key] ?? 0) + 1;
            return accumulator;
          }, {}),
        ).map(([date, value]) => ({ date, value })),
      ),
    },
    mailboxes: mailboxes
      .map((mailbox) => ({
        id: mailbox.id,
        emailAddress: mailbox.emailAddress,
        displayName: mailbox.displayName,
        provider: mailbox.provider,
        status: mailbox.status,
        group: mailbox.group,
        lastSyncedAt: mailbox.lastSyncedAt,
        lastError: mailbox.lastError,
        messageCount: mailbox._count.messages,
        jobCount: mailbox._count.scanJobs,
      }))
      .sort(compareMailboxesByStatusDisplayNameEmail),
    recentActivity: [
      ...buildRecentSyncActivity(recentJobs),
      ...recentOtps.map((otp) => ({
        id: otp.id,
        type: "otp" as const,
        title: otp.code,
        description: otp.message.mailbox.emailAddress,
        timestamp: otp.detectedAt,
      })),
      ...recentOrders.map((order) => ({
        id: order.id,
        type: "order" as const,
        title: order.merchantName ?? order.orderId ?? "Order extraction",
        description: order.message.mailbox.emailAddress,
        timestamp: order.receivedAt ?? order.createdAt,
      })),
    ]
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
      .slice(0, 8),
  };
}
