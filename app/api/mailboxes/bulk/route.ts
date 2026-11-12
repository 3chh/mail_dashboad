import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { MailProvider, MailboxAuthType, MailboxStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/mail/token-vault";
import { requestMicrosoftTokenRefresh } from "@/lib/mail/adapters/microsoft-graph";

const bulkImportSchema = z.object({
  rawText: z.string().min(1, "Vui lòng nhập danh sách mail."),
  groupId: z.string().trim().optional().or(z.literal("")),
  newGroupName: z.string().trim().max(80).optional().or(z.literal("")),
});

function parseMailboxLine(line: string) {
  const delimiter = line.includes("|") ? "|" : "\t";
  const rawParts = line.split(delimiter).map((p) => p.trim()).filter(Boolean);

  if (rawParts.length === 0) return null;

  let email: string | null = null;
  let recoveryEmail: string | null = null;
  let clientId: string | null = null;
  let refreshToken: string | null = null;
  let password: string | null = null;

  // UUID pattern for Azure Client ID: 8-4-4-4-12 hex chars (or 32 hex chars)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hex32Regex = /^[0-9a-f]{32}$/i;

  const emails: string[] = [];
  const otherParts: string[] = [];

  for (const part of rawParts) {
    if (part.includes("@") && !part.includes(" ")) {
      emails.push(part.toLowerCase());
    } else {
      otherParts.push(part);
    }
  }

  if (emails.length > 0) {
    email = emails[0];
    if (emails.length > 1) {
      recoveryEmail = emails[1];
    }
  } else {
    email = rawParts[0]?.toLowerCase() ?? null;
  }

  for (const part of otherParts) {
    if (uuidRegex.test(part) || hex32Regex.test(part)) {
      clientId = part;
    } else if (part.length > 50) {
      // Refresh token is always long (>50 chars, typically 100-800 chars)
      refreshToken = part;
    } else if (!password) {
      password = part;
    } else if (!recoveryEmail && part.includes("@")) {
      recoveryEmail = part;
    }
  }

  // Fallback to standard positional mapping if not found by heuristics:
  // email|pass|token|id|recoveryEmail
  if (!refreshToken && rawParts[2] && rawParts[2].length > 20) {
    refreshToken = rawParts[2];
  }
  if (!clientId && rawParts[3]) {
    clientId = rawParts[3];
  }
  if (!password && rawParts[1]) {
    password = rawParts[1];
  }
  if (!recoveryEmail && rawParts[4]) {
    recoveryEmail = rawParts[4];
  }

  return { email, password, refreshToken, clientId, recoveryEmail };
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
  const importedEmails: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parsedLine = parseMailboxLine(lines[i]);
    if (!parsedLine || !parsedLine.email || !parsedLine.email.includes("@")) {
      errors.push(`Dòng ${i + 1}: Không thể nhận diện email hợp lệ.`);
      continue;
    }

    const { email, password, refreshToken, clientId, recoveryEmail } = parsedLine;
    const isGmail = email.endsWith("@gmail.com") || email.endsWith("@googlemail.com");
    const provider = isGmail ? MailProvider.GMAIL : MailProvider.OUTLOOK;

    const notesPayload: Record<string, string | null> = {};
    if (clientId) notesPayload.clientId = clientId;
    if (password) notesPayload.password = password;
    if (recoveryEmail) notesPayload.recoveryEmail = recoveryEmail;

    const notesString = Object.keys(notesPayload).length > 0 ? JSON.stringify(notesPayload) : null;
    const hasOAuthToken = Boolean(refreshToken);

    let accessTokenToSave: string | null = null;
    let rotatedRefreshToken = refreshToken;
    let tokenExpiresAt: Date | null = null;
    let initialStatus: MailboxStatus = hasOAuthToken ? MailboxStatus.ACTIVE : MailboxStatus.PENDING_CONSENT;
    let initialError: string | null = null;

    if (hasOAuthToken && provider === MailProvider.OUTLOOK) {
      try {
        const refreshed = await requestMicrosoftTokenRefresh({
          refreshToken: refreshToken!,
          clientId,
        });

        if (refreshed.access_token) {
          accessTokenToSave = refreshed.access_token;
          if (refreshed.refresh_token) {
            rotatedRefreshToken = refreshed.refresh_token;
          }
          if (refreshed.expires_in) {
            tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
          }
          initialStatus = MailboxStatus.ACTIVE;
        }
      } catch (tokenErr: any) {
        initialStatus = MailboxStatus.ERROR;
        initialError = tokenErr.message || "Lỗi kiểm tra token Microsoft.";
        errors.push(`Dòng ${i + 1} (${email}): ${initialError}`);
      }
    }

    try {
      await prisma.mailbox.upsert({
        where: {
          emailAddress: email,
        },
        update: {
          provider,
          groupId,
          createdById: admin.id,
          lastError: initialError,
          status: initialStatus,
          customClientId: clientId || undefined,
          recoveryEmail: recoveryEmail || undefined,
          notes: notesString,
          ...(hasOAuthToken
            ? {
                authType: MailboxAuthType.OAUTH,
                refreshTokenEncrypted: encryptSecret(rotatedRefreshToken!),
                accessTokenEncrypted: accessTokenToSave ? encryptSecret(accessTokenToSave) : undefined,
                tokenExpiresAt: tokenExpiresAt || undefined,
                consentedAt: new Date(),
              }
            : {}),
        },
        create: {
          emailAddress: email,
          provider,
          authType: MailboxAuthType.OAUTH,
          groupId,
          createdById: admin.id,
          status: initialStatus,
          refreshTokenEncrypted: hasOAuthToken ? encryptSecret(rotatedRefreshToken!) : null,
          accessTokenEncrypted: accessTokenToSave ? encryptSecret(accessTokenToSave) : null,
          tokenExpiresAt,
          consentedAt: hasOAuthToken ? new Date() : null,
          customClientId: clientId || null,
          recoveryEmail: recoveryEmail || null,
          notes: notesString,
          lastError: initialError,
        },
      });

      importedCount++;
      importedEmails.push(email);
      if (initialStatus === MailboxStatus.ACTIVE) {
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
    importedEmails,
    errors,
  });
}
