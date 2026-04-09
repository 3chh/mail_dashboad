import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

const updateMailboxSchema = z.object({
  displayName: z.string().trim().max(120).optional().or(z.literal("")),
  groupId: z.string().trim().optional().or(z.literal("")),
  newGroupName: z.string().trim().max(80).optional().or(z.literal("")),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return resolveAdminFromSessionUser(session?.user);
}

async function resolveMailboxGroup(adminUserId: string, args: { groupId?: string; newGroupName?: string }) {
  const newGroupName = args.newGroupName?.trim();
  if (newGroupName) {
    const group = await prisma.mailboxGroup.upsert({
      where: {
        name: newGroupName,
      },
      update: {},
      create: {
        name: newGroupName,
        createdById: adminUserId,
      },
      select: {
        id: true,
      },
    });

    return group.id;
  }

  const groupId = args.groupId?.trim();
  if (!groupId) {
    return null;
  }

  const group = await prisma.mailboxGroup.findFirst({
    where: {
      id: groupId,
      OR: [{ createdById: adminUserId }, { createdById: null }],
    },
    select: {
      id: true,
    },
  });

  return group?.id ?? null;
}

export async function PATCH(request: Request, context: { params: Promise<{ mailboxId: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { mailboxId } = await context.params;
  const parsed = updateMailboxSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu mailbox không hợp lệ." }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id: mailboxId,
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
    select: {
      id: true,
    },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "Không tìm thấy mailbox." }, { status: 404 });
  }

  const groupId = await resolveMailboxGroup(admin.id, {
    groupId: parsed.data.groupId || undefined,
    newGroupName: parsed.data.newGroupName || undefined,
  });

  const updated = await prisma.mailbox.update({
    where: {
      id: mailboxId,
    },
    data: {
      displayName: parsed.data.displayName?.trim() || null,
      groupId,
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ mailbox: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ mailboxId: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { mailboxId } = await context.params;
  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id: mailboxId,
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
    select: {
      id: true,
    },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "Không tìm thấy mailbox." }, { status: 404 });
  }

  await prisma.mailbox.delete({
    where: {
      id: mailboxId,
    },
  });

  return NextResponse.json({ ok: true });
}
