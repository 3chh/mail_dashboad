import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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
