import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

const mailboxGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const parsed = mailboxGroupSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu nhóm mailbox không hợp lệ." }, { status: 400 });
  }

  const group = await prisma.mailboxGroup.upsert({
    where: {
      name: parsed.data.name,
    },
    update: {},
    create: {
      name: parsed.data.name,
      createdById: admin.id,
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
