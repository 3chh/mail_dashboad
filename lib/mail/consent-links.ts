import { randomUUID } from "node:crypto";
import { MailboxStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildGoogleConsentUrl } from "@/lib/mail/adapters/gmail-api";
import { buildMicrosoftConsentUrl } from "@/lib/mail/adapters/microsoft-graph";

export async function createMailboxConsentUrl(args: { adminUserId: string; mailboxId: string }) {
  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id: args.mailboxId,
      OR: [{ createdById: args.adminUserId }, { createdById: null }],
    },
    select: {
      id: true,
      provider: true,
      emailAddress: true,
    },
  });

  if (!mailbox) {
    throw new Error("MAILBOX_NOT_FOUND");
  }

  const state = randomUUID();

  await prisma.$transaction([
    prisma.mailboxOAuthState.create({
      data: {
        mailboxId: mailbox.id,
        provider: mailbox.provider,
        state,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    }),
    prisma.mailbox.update({
      where: {
        id: mailbox.id,
      },
      data: {
        status: MailboxStatus.PENDING_CONSENT,
        lastError: null,
      },
    }),
  ]);

  return {
    mailboxId: mailbox.id,
    emailAddress: mailbox.emailAddress,
    provider: mailbox.provider,
    url: mailbox.provider === "GMAIL" ? buildGoogleConsentUrl(state) : buildMicrosoftConsentUrl(state),
  };
}
