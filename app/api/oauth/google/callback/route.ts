import { NextResponse } from "next/server";
import { MailboxStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { exchangeGoogleCode } from "@/lib/mail/adapters/gmail-api";
import { buildPublicAppUrl } from "@/lib/mail/oauth-helpers";
import { encryptSecret } from "@/lib/mail/token-vault";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(buildPublicAppUrl(`/dashboard?error=${encodeURIComponent(error)}`));
  }

  if (!state || !code) {
    return NextResponse.redirect(buildPublicAppUrl("/dashboard?error=invalid-oauth-response"));
  }

  const oauthState = await prisma.mailboxOAuthState.findUnique({
    where: {
      state,
    },
    include: {
      mailbox: true,
    },
  });

  if (!oauthState || oauthState.consumedAt || oauthState.expiresAt.getTime() < Date.now()) {
    return NextResponse.redirect(buildPublicAppUrl("/dashboard?error=expired-state"));
  }

  try {
    const token = await exchangeGoogleCode(code);

    if (!token.emailAddress || token.emailAddress !== oauthState.mailbox.emailAddress.toLowerCase()) {
      throw new Error("Email tài khoản Google không khớp với mailbox.");
    }

    await prisma.$transaction([
      prisma.mailbox.update({
        where: {
          id: oauthState.mailboxId,
        },
        data: {
          externalUserId: token.externalUserId,
          displayName: oauthState.mailbox.displayName ?? token.emailAddress,
          accessTokenEncrypted: token.accessToken ? encryptSecret(token.accessToken) : null,
          refreshTokenEncrypted: token.refreshToken ? encryptSecret(token.refreshToken) : oauthState.mailbox.refreshTokenEncrypted,
          tokenExpiresAt: token.tokenExpiresAt,
          grantedScopes: token.scopes,
          consentedAt: new Date(),
          status: MailboxStatus.ACTIVE,
          lastError: null,
        },
      }),
      prisma.mailboxOAuthState.update({
        where: {
          state,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.redirect(buildPublicAppUrl("/dashboard?connected=gmail"));
  } catch (oauthError) {
    const message = oauthError instanceof Error ? oauthError.message : "Google mailbox connect failed.";

    await prisma.mailbox.update({
      where: {
        id: oauthState.mailboxId,
      },
      data: {
        status: MailboxStatus.ERROR,
        lastError: message,
      },
    });

    return NextResponse.redirect(buildPublicAppUrl(`/dashboard?error=${encodeURIComponent(message)}`));
  }
}