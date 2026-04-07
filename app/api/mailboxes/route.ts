import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { MailProvider, MailboxAuthType, MailboxStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

const createMailboxSchema = z.object({
  emailAddress: z.string().email(),
  provider: z.nativeEnum(MailProvider),
  displayName: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const parsed = createMailboxSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload mailbox không hợp lệ." }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.upsert({
    where: {
      emailAddress: parsed.data.emailAddress.trim().toLowerCase(),
    },
    update: {
      provider: parsed.data.provider,
      displayName: parsed.data.displayName?.trim() || null,
      status: MailboxStatus.PENDING_CONSENT,
      createdById: admin.id,
      lastError: null,
    },
    create: {
      emailAddress: parsed.data.emailAddress.trim().toLowerCase(),
      displayName: parsed.data.displayName?.trim() || null,
      provider: parsed.data.provider,
      authType: MailboxAuthType.OAUTH,
      status: MailboxStatus.PENDING_CONSENT,
      createdById: admin.id,
    },
  });

  return NextResponse.json({ mailbox }, { status: 201 });
}
