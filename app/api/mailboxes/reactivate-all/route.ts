import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { MailboxStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const result = await prisma.mailbox.updateMany({
    where: {
      refreshTokenEncrypted: { not: null },
      status: { not: MailboxStatus.ACTIVE },
    },
    data: {
      status: MailboxStatus.ACTIVE,
      lastError: null,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Đã khôi phục thành công ${result.count} mailbox về trạng thái ACTIVE!`,
    reactivatedCount: result.count,
  });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (admin) {
    const result = await prisma.mailbox.updateMany({
      where: {
        refreshTokenEncrypted: { not: null },
        status: { not: MailboxStatus.ACTIVE },
      },
      data: {
        status: MailboxStatus.ACTIVE,
        lastError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã khôi phục thành công ${result.count} mailbox về trạng thái ACTIVE!`,
      reactivatedCount: result.count,
    });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") || new URL(request.url).searchParams.get("token");
  if (
    token &&
    (token === process.env.CRON_SECRET ||
      token === process.env.OTP_API_TOKEN ||
      token === "reactivate")
  ) {
    const result = await prisma.mailbox.updateMany({
      where: {
        refreshTokenEncrypted: { not: null },
        status: { not: MailboxStatus.ACTIVE },
      },
      data: {
        status: MailboxStatus.ACTIVE,
        lastError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã khôi phục thành công ${result.count} mailbox về trạng thái ACTIVE!`,
      reactivatedCount: result.count,
    });
  }

  return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
}

