import { subDays } from "date-fns";
import { MailboxStatus } from "@prisma/client";
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
      include: {
        mailbox: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
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
      ...recentJobs.map((job) => ({
        id: job.id,
        type: "sync" as const,
        title: job.mailbox.emailAddress,
        description: `${job.status} - ${job.scannedCount}/${job.totalMessagesFound || job.scannedCount}`,
        timestamp: job.createdAt,
      })),
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
