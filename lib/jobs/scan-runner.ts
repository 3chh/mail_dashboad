import { MailboxStatus, ScanJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildSyncJobLabel } from "@/lib/mail/query";
import {
  fetchAndParseMessage,
  listMessageRefsForMailbox,
  upsertParsedMessage,
} from "@/lib/mail/service";
import { markJobFinished, markJobRunning } from "@/lib/jobs/scan-queue";

const MAX_SYNC_MESSAGES = 500;

async function appendJobLog(args: {
  scanJobId: string;
  adminUserId?: string | null;
  mailboxId: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
}) {
  await prisma.extractionLog.create({
    data: {
      scanJobId: args.scanJobId,
      adminUserId: args.adminUserId ?? undefined,
      mailboxId: args.mailboxId,
      level: args.level,
      message: args.message,
      contextJson: args.context ? JSON.stringify(args.context) : null,
    },
  });
}

async function processSingleMessage(args: {
  mailboxId: string;
  scanJobId: string;
  remoteMessageId: string;
}) {
  const mailbox = await prisma.mailbox.findUnique({
    where: {
      id: args.mailboxId,
    },
  });

  if (!mailbox) {
    throw new Error("Không tìm thấy mailbox.");
  }

  const parsed = await fetchAndParseMessage({
    mailbox,
    remoteMessageId: args.remoteMessageId,
  });

  await upsertParsedMessage({
    mailboxId: args.mailboxId,
    message: parsed,
    scanJobId: args.scanJobId,
  });

  return {
    saved: 1,
  };
}

async function collectMessageIdsForJob(args: {
  mailboxId: string;
  lookbackDays: number;
}) {
  const mailbox = await prisma.mailbox.findUnique({
    where: {
      id: args.mailboxId,
    },
  });
  if (!mailbox) {
    throw new Error("Không tìm thấy mailbox.");
  }

  const result = await listMessageRefsForMailbox({
    mailbox,
    lookbackDays: args.lookbackDays,
    maxResults: MAX_SYNC_MESSAGES,
  });

  return {
    estimatedTotal: result.estimatedTotal ?? result.refs.length,
    ids: result.refs.map((ref) => ref.remoteId).filter(Boolean).slice(0, MAX_SYNC_MESSAGES),
  };
}

export async function runScanJob(scanJobId: string) {
  if (!markJobRunning(scanJobId)) {
    return;
  }

  try {
    const job = await prisma.scanJob.findUnique({
      where: {
        id: scanJobId,
      },
      include: {
        mailbox: true,
      },
    });

    if (!job) {
      return;
    }

    await prisma.scanJob.update({
      where: {
        id: scanJobId,
      },
      data: {
        status: ScanJobStatus.RUNNING,
        startedAt: new Date(),
        errorMessage: null,
        otpDetectionsFound: 0,
        orderExtractionsFound: 0,
      },
    });

    await appendJobLog({
      scanJobId,
      adminUserId: job.adminUserId,
      mailboxId: job.mailboxId,
      level: "info",
      message: "Bắt đầu đồng bộ mailbox.",
      context: {
        mailbox: job.mailbox.emailAddress,
        syncWindowDays: job.syncWindowDays,
      },
    });

    const { ids, estimatedTotal } = await collectMessageIdsForJob({
      mailboxId: job.mailboxId,
      lookbackDays: job.syncWindowDays ?? 7,
    });

    await prisma.scanJob.update({
      where: {
        id: scanJobId,
      },
      data: {
        totalMessagesFound: estimatedTotal,
      },
    });

    let scannedCount = 0;
    let savedCount = 0;

    for (const remoteMessageId of ids) {
      const result = await processSingleMessage({
        mailboxId: job.mailboxId,
        scanJobId,
        remoteMessageId,
      });

      scannedCount += 1;
      savedCount += result.saved;

      await prisma.scanJob.update({
        where: {
          id: scanJobId,
        },
        data: {
          scannedCount,
          savedCount,
          otpDetectionsFound: 0,
          orderExtractionsFound: 0,
        },
      });
    }

    await prisma.mailbox.update({
      where: {
        id: job.mailboxId,
      },
      data: {
        lastSyncedAt: new Date(),
        lastError: null,
        status: MailboxStatus.ACTIVE,
      },
    });

    await prisma.scanJob.update({
      where: {
        id: scanJobId,
      },
      data: {
        status: ScanJobStatus.COMPLETED,
        completedAt: new Date(),
        otpDetectionsFound: 0,
        orderExtractionsFound: 0,
      },
    });

    await appendJobLog({
      scanJobId,
      adminUserId: job.adminUserId,
      mailboxId: job.mailboxId,
      level: "info",
      message: "Đồng bộ mailbox thành công.",
      context: {
        scannedCount,
        savedCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đồng bộ mailbox thất bại.";

    const job = await prisma.scanJob.update({
      where: {
        id: scanJobId,
      },
      data: {
        status: ScanJobStatus.FAILED,
        completedAt: new Date(),
        errorMessage: message,
      },
      include: {
        mailbox: true,
      },
    });

    await prisma.mailbox.update({
      where: {
        id: job.mailboxId,
      },
      data: {
        lastError: message,
        status: MailboxStatus.ERROR,
      },
    });

    await appendJobLog({
      scanJobId,
      adminUserId: job.adminUserId,
      mailboxId: job.mailboxId,
      level: "error",
      message: "Đồng bộ mailbox thất bại.",
      context: {
        error: message,
      },
    });
  } finally {
    markJobFinished(scanJobId);
  }
}

export async function enqueueScanJob(scanJobId: string) {
  setTimeout(() => {
    void runScanJob(scanJobId);
  }, 0);
}

export async function createAndEnqueueScanJobs(args: {
  adminUserId?: string;
  mailboxIds: string[];
  syncWindowDays: number;
}) {
  const jobs = await prisma.$transaction(
    args.mailboxIds.map((mailboxId) =>
      prisma.scanJob.create({
        data: {
          adminUserId: args.adminUserId || null,
          mailboxId,
          status: ScanJobStatus.QUEUED,
          jobName: buildSyncJobLabel(args.syncWindowDays),
          syncWindowDays: args.syncWindowDays,
        },
      }),
    ),
  );

  await Promise.all(jobs.map((job) => enqueueScanJob(job.id)));
  return jobs;
}
