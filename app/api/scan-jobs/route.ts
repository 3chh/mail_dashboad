import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { MailboxStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { createAndEnqueueScanJobs } from "@/lib/jobs/scan-runner";
import { listActiveMailboxIds } from "@/lib/mail/service";
import { getScanJobsData } from "@/lib/queries/app-data";
import { prisma } from "@/lib/db/prisma";

const createScanJobSchema = z.object({
  mailboxIds: z.array(z.string().min(1)).optional(),
  syncWindowDays: z.number().int().positive().max(30).default(7),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const jobs = await getScanJobsData(admin.id);
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const parsed = createScanJobSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload đồng bộ không hợp lệ." }, { status: 400 });
  }

  const requestedMailboxIds = parsed.data.mailboxIds ?? [];
  const mailboxIds =
    requestedMailboxIds.length > 0 ? requestedMailboxIds : await listActiveMailboxIds(admin.id);

  if (mailboxIds.length === 0) {
    return NextResponse.json({ error: "Không có mailbox hoạt động nào được chọn." }, { status: 400 });
  }

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      id: {
        in: mailboxIds,
      },
      status: MailboxStatus.ACTIVE,
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
    select: {
      id: true,
    },
  });

  if (mailboxes.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy mailbox có thể kết nối." }, { status: 400 });
  }

  const jobs = await createAndEnqueueScanJobs({
    adminUserId: admin.id,
    mailboxIds: mailboxes.map((mailbox) => mailbox.id),
    syncWindowDays: parsed.data.syncWindowDays,
  });

  return NextResponse.json({ jobIds: jobs.map((job) => job.id) }, { status: 201 });
}
