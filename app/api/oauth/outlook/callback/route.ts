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
      message: `Microsoft trả về lỗi: ${error}`,
    });
  }

  if (!state || !code) {
    return renderOAuthCompletionPage({
      success: false,
      provider: "outlook",
      message: "Phản hồi OAuth không hợp lệ hoặc thiếu mã xác thực.",
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
      message: "Liên kết consent đã hết hạn hoặc đã được dùng trước đó.",
      mailboxEmail: oauthState?.mailbox.emailAddress ?? null,
    });
  }

  try {
    const token = await exchangeMicrosoftCode(code);

    if (!token.emailAddress || token.emailAddress !== oauthState.mailbox.emailAddress.toLowerCase()) {
      throw new Error("Email tài khoản Outlook không khớp với mailbox.");
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
      message: "Cấp quyền đọc mail thành công. Trạng thái mailbox đã được cập nhật sang kết nối thành công.",
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
