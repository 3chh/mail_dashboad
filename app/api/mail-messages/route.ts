import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
    select: { id: true },
  });

  const mailboxIds = mailboxes.map((m) => m.id);

  if (mailboxIds.length === 0) {
    return NextResponse.json({ deletedCount: 0 });
  }

  const result = await prisma.mailMessage.deleteMany({
    where: {
      mailboxId: { in: mailboxIds },
    },
  });

  return NextResponse.json({ deletedCount: result.count });
}
