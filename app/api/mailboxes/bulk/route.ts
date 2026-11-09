import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { MailProvider, MailboxAuthType, MailboxStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/mail/token-vault";

const bulkImportSchema = z.object({
  rawText: z.string().min(1, "Vui lòng nhập danh sách mail."),
  groupId: z.string().trim().optional().or(z.literal("")),
  newGroupName: z.string().trim().max(80).optional().or(z.literal("")),
});

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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bulkImportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Payload không hợp lệ." }, { status: 400 });
  }

  const groupId = await resolveMailboxGroup(admin.id, {
    groupId: parsed.data.groupId || undefined,
    newGroupName: parsed.data.newGroupName || undefined,
  });

  const lines = parsed.data.rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy dòng dữ liệu nào." }, { status: 400 });
  }

  let importedCount = 0;
  let activeCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Tách theo pipe (|), nếu không có thì thử tách theo tab (\t)
    const delimiter = line.includes("|") ? "|" : "\t";
    const parts = line.split(delimiter).map((p) => p.trim());

    const email = parts[0]?.toLowerCase();
    if (!email || !email.includes("@") || email.includes(" ")) {
      errors.push(`Dòng ${i + 1}: Email không hợp lệ ("${parts[0] || ""}")`);
      continue;
    }

    const password = parts[1] || null;
    const token = parts[2] || null;
    const clientId = parts[3] || null;
    const recoveryEmail = parts[4] || null;

    const isGmail = email.endsWith("@gmail.com") || email.endsWith("@googlemail.com");
    const provider = isGmail ? MailProvider.GMAIL : MailProvider.OUTLOOK;

    const notesPayload: Record<string, string | null> = {};
    if (clientId) notesPayload.clientId = clientId;
    if (password) notesPayload.password = password;
    if (recoveryEmail) notesPayload.recoveryEmail = recoveryEmail;

    const notesString = Object.keys(notesPayload).length > 0 ? JSON.stringify(notesPayload) : null;
    const hasOAuthToken = Boolean(token);

    try {
      await prisma.mailbox.upsert({
        where: {
          emailAddress: email,
        },
        update: {
          provider,
          groupId,
          createdById: admin.id,
          lastError: null,
          ...(hasOAuthToken
            ? {
                status: MailboxStatus.ACTIVE,
                authType: MailboxAuthType.OAUTH,
                refreshTokenEncrypted: encryptSecret(token!),
                consentedAt: new Date(),
                externalUserId: clientId || undefined,
                notes: notesString,
              }
            : {
                notes: notesString,
              }),
        },
        create: {
          emailAddress: email,
          provider,
          authType: MailboxAuthType.OAUTH,
          groupId,
          createdById: admin.id,
          status: hasOAuthToken ? MailboxStatus.ACTIVE : MailboxStatus.PENDING_CONSENT,
          refreshTokenEncrypted: hasOAuthToken ? encryptSecret(token!) : null,
          consentedAt: hasOAuthToken ? new Date() : null,
          externalUserId: clientId || null,
          notes: notesString,
        },
      });

      importedCount++;
      if (hasOAuthToken) {
        activeCount++;
      }
    } catch (err: any) {
      errors.push(`Dòng ${i + 1} (${email}): ${err.message || "Lỗi lưu DB"}`);
    }
  }

  return NextResponse.json({
    success: true,
    total: lines.length,
    importedCount,
    activeCount,
    errors,
  });
}

