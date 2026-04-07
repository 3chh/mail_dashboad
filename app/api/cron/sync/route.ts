import { NextResponse } from "next/server";
import { MailboxStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createAndEnqueueScanJobs } from "@/lib/jobs/scan-runner";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const mailboxes = await prisma.mailbox.findMany({
    where: {
      status: MailboxStatus.ACTIVE,
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: staleBefore } }],
    },
    select: {
      id: true,
    },
    take: 50,
  });

  if (mailboxes.length === 0) {
    return NextResponse.json({ scheduled: 0 });
  }

  const jobs = await createAndEnqueueScanJobs({
    mailboxIds: mailboxes.map((mailbox) => mailbox.id),
    syncWindowDays: 7,
  });

  return NextResponse.json({ scheduled: jobs.length });
}
