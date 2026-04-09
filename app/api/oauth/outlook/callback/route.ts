import { MailboxStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { exchangeMicrosoftCode } from "@/lib/mail/adapters/microsoft-graph";
import { renderOAuthCompletionPage } from "@/lib/mail/oauth-completion";
import { encryptSecret } from "@/lib/mail/token-vault";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return renderOAuthCompletionPage({
      success: false,
      provider: "outlook",
      message: `Microsoft tr? v? l?i: ${error}`,
    });
  }

  if (!state || !code) {
    return renderOAuthCompletionPage({
      success: false,
      provider: "outlook",
      message: "Ph?n h?i OAuth kh?ng h?p l? ho?c thi?u m? x?c th?c.",
    });
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
    return renderOAuthCompletionPage({
      success: false,
      provider: "outlook",
      message: "Li?n k?t consent ?? h?t h?n ho?c ?? ???c d?ng tr??c ??.",
      mailboxEmail: oauthState?.mailbox.emailAddress ?? null,
    });
  }

  try {
    const token = await exchangeMicrosoftCode(code);

    if (!token.emailAddress || token.emailAddress !== oauthState.mailbox.emailAddress.toLowerCase()) {
      throw new Error("Email t?i kho?n Outlook kh?ng kh?p v?i mailbox.");
    }

    await prisma.$transaction([
      prisma.mailbox.update({
        where: {
          id: oauthState.mailboxId,
        },
        data: {
          externalUserId: token.externalUserId,
          displayName: oauthState.mailbox.displayName ?? token.displayName ?? token.emailAddress,
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

    return renderOAuthCompletionPage({
      success: true,
      provider: "outlook",
      message: "?? c?p quy?n ??c mail th?nh c?ng. Tr?ng th?i mailbox ?? ???c c?p nh?t sang k?t n?i th?nh c?ng.",
      mailboxEmail: oauthState.mailbox.emailAddress,
    });
  } catch (oauthError) {
    const message = oauthError instanceof Error ? oauthError.message : "Outlook mailbox connect failed.";

    await prisma.mailbox.update({
      where: {
        id: oauthState.mailboxId,
      },
      data: {
        status: MailboxStatus.ERROR,
        lastError: message,
      },
    });

    return renderOAuthCompletionPage({
      success: false,
      provider: "outlook",
      message,
      mailboxEmail: oauthState.mailbox.emailAddress,
    });
  }
}
