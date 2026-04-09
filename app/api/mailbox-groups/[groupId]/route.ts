import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

const updateMailboxGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return resolveAdminFromSessionUser(session?.user);
}

export async function PATCH(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { groupId } = await context.params;
  const parsed = updateMailboxGroupSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Tên nhóm không hợp lệ." }, { status: 400 });
  }

  const group = await prisma.mailboxGroup.findFirst({
    where: {
      id: groupId,
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Không tìm thấy nhóm mailbox." }, { status: 404 });
  }

  const updated = await prisma.mailboxGroup.update({
    where: {
      id: groupId,
    },
    data: {
      name: parsed.data.name,
    },
  });

  return NextResponse.json({ group: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { groupId } = await context.params;
  const group = await prisma.mailboxGroup.findFirst({
    where: {
      id: groupId,
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Không tìm thấy nhóm mailbox." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.mailbox.updateMany({
      where: {
        groupId,
      },
      data: {
        groupId: null,
      },
    }),
    prisma.mailboxGroup.delete({
      where: {
        id: groupId,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
