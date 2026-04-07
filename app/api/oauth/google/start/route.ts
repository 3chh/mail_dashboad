import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { MailProvider, MailboxStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { buildGoogleConsentUrl } from "@/lib/mail/adapters/gmail-api";
import { buildPublicAppUrl } from "@/lib/mail/oauth-helpers";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.redirect(buildPublicAppUrl("/sign-in"));
  }

  const url = new URL(request.url);
  const mailboxId = url.searchParams.get("mailboxId");

  if (!mailboxId) {
    return NextResponse.redirect(buildPublicAppUrl("/dashboard?error=missing-mailbox"));
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id: mailboxId,
      provider: MailProvider.GMAIL,
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
    select: {
      id: true,
    },
  });

  if (!mailbox) {
    return NextResponse.redirect(buildPublicAppUrl("/dashboard?error=mailbox-not-found"));
  }

  const state = randomUUID();

  await prisma.mailboxOAuthState.create({
    data: {
      mailboxId,
      provider: MailProvider.GMAIL,
      state,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  await prisma.mailbox.update({
    where: {
      id: mailboxId,
    },
    data: {
      status: MailboxStatus.PENDING_CONSENT,
      lastError: null,
    },
  });

  return NextResponse.redirect(buildGoogleConsentUrl(state));
}