import { google } from "googleapis";
import { prisma } from "@/lib/db/prisma";
import { getPublicAppUrl } from "@/lib/mail/oauth-helpers";

type GoogleAccountRecord = {
  provider: string;
  providerAccountId: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string | null;
};

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

function hasRequiredGmailScope(scope: string | null | undefined) {
  return scope?.split(/\s+/).includes(GMAIL_READONLY_SCOPE) ?? false;
}

function getReconnectMessage() {
  return "Tài khoản Google hiện chưa cấp quyền đọc Gmail. Vào Cài đặt, bấm 'Kết nối lại tài khoản Google', sau đó chấp nhận quyền Gmail khi Google yêu cầu.";
}

async function refreshGoogleAccessToken(account: GoogleAccountRecord) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getPublicAppUrl()}/api/auth/callback/google`,
  );

  client.setCredentials({
    refresh_token: account.refresh_token ?? undefined,
  });

  const { credentials } = await client.refreshAccessToken();

  await prisma.account.update({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    data: {
      access_token: credentials.access_token ?? account.access_token,
      expires_at: credentials.expiry_date
        ? Math.floor(credentials.expiry_date / 1000)
        : account.expires_at,
      refresh_token: credentials.refresh_token ?? account.refresh_token,
      scope: credentials.scope ?? undefined,
      token_type: credentials.token_type ?? undefined,
      id_token: credentials.id_token ?? undefined,
    },
  });

  return credentials;
}

export async function getGoogleAccessTokenForUser(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      provider: true,
      providerAccountId: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true,
    },
  });

  if (!account) {
    throw new Error("Không tìm thấy tài khoản Google nào được kết nối.");
  }

  if (!account.refresh_token && !account.access_token) {
    throw new Error("Tài khoản Google thiếu thông tin xác thực OAuth.");
  }

  if (account.scope && !hasRequiredGmailScope(account.scope)) {
    throw new Error(getReconnectMessage());
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const isExpired = !account.expires_at || account.expires_at <= nowInSeconds + 60;

  if (account.access_token && !isExpired) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error("Thiếu refresh token Google. Vui lòng kết nối lại tài khoản.");
  }

  const refreshed = await refreshGoogleAccessToken(account);

  if (!refreshed.access_token) {
    throw new Error("Làm mới token Google thất bại.");
  }

  if (refreshed.scope && !hasRequiredGmailScope(refreshed.scope)) {
    throw new Error(getReconnectMessage());
  }

  return refreshed.access_token;
}

export async function getGoogleAuthClientForUser(userId: string) {
  const accessToken = await getGoogleAccessTokenForUser(userId);

  const client = new google.auth.OAuth2();
  client.setCredentials({
    access_token: accessToken,
  });

  return client;
}