import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ScanJobStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { jobId } = await params;

  const job = await prisma.scanJob.findFirst({
    where: {
      id: jobId,
      OR: [{ adminUserId: admin.id }, { adminUserId: null }],
    },
    include: {
      mailbox: true,
      logs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Không tìm thấy job đồng bộ." }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { jobId } = await params;

  const jobs = await prisma.scanJob.findMany({
    where: {
      AND: [
        {
          OR: [{ adminUserId: admin.id }, { adminUserId: null }],
        },
        {
          OR: [{ batchId: jobId }, { id: jobId }],
        },
      ],
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (jobs.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy lịch sử đồng bộ." }, { status: 404 });
  }

  if (jobs.some((job) => job.status === ScanJobStatus.QUEUED || job.status === ScanJobStatus.RUNNING)) {
    return NextResponse.json({ error: "Chỉ có thể xóa lịch sử đã kết thúc." }, { status: 409 });
  }

  const result = await prisma.scanJob.deleteMany({
    where: {
      id: {
        in: jobs.map((job) => job.id),
      },
    },
  });

  return NextResponse.json({ deletedCount: result.count });
}
