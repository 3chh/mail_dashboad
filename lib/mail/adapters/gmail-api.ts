import { google } from "googleapis";
import { MailProvider, Mailbox, MailboxStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseGmailApiMessage } from "@/lib/mail/parser";
import { getAppBaseUrl } from "@/lib/mail/oauth-helpers";
import { decryptSecret, encryptSecret } from "@/lib/mail/token-vault";

export const GOOGLE_MAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function getGoogleClient(redirectPath = "/api/oauth/google/callback") {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getAppBaseUrl()}${redirectPath}`,
  );
}

export function buildGoogleConsentUrl(state: string) {
  const client = getGoogleClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    response_type: "code",
    scope: GOOGLE_MAIL_SCOPES,
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = getGoogleClient();
  const { tokens } = await client.getToken(code);

  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();

  return {
    externalUserId: profile.data.id ?? null,
    emailAddress: profile.data.email?.toLowerCase() ?? null,
    scopes: tokens.scope ?? GOOGLE_MAIL_SCOPES.join(" "),
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

async function refreshGoogleAccessToken(mailbox: Mailbox) {
  const refreshToken = decryptSecret(mailbox.refreshTokenEncrypted);

  if (!refreshToken) {
    throw new Error("Thiếu refresh token Google.");
  }

  const client = getGoogleClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();

  await prisma.mailbox.update({
    where: {
      id: mailbox.id,
    },
    data: {
      accessTokenEncrypted: credentials.access_token
        ? encryptSecret(credentials.access_token)
        : mailbox.accessTokenEncrypted,
      refreshTokenEncrypted: credentials.refresh_token
        ? encryptSecret(credentials.refresh_token)
        : mailbox.refreshTokenEncrypted,
      tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : mailbox.tokenExpiresAt,
      grantedScopes: credentials.scope ?? mailbox.grantedScopes,
      lastError: null,
      status: MailboxStatus.ACTIVE,
    },
  });

  return credentials.access_token ?? decryptSecret(mailbox.accessTokenEncrypted);
}

export async function getGoogleAccessToken(mailbox: Mailbox) {
  if (mailbox.provider !== MailProvider.GMAIL) {
    throw new Error("Nhà cung cấp mailbox không khớp.");
  }

  const accessToken = decryptSecret(mailbox.accessTokenEncrypted);
  const expiresSoon = !mailbox.tokenExpiresAt || mailbox.tokenExpiresAt.getTime() <= Date.now() + 60_000;

  if (accessToken && !expiresSoon) {
    return accessToken;
  }

  const refreshed = await refreshGoogleAccessToken(mailbox);
  if (!refreshed) {
    throw new Error("Không thể làm mới access token Google.");
  }

  return refreshed;
}

async function getGmailClient(mailbox: Mailbox) {
  const accessToken = await getGoogleAccessToken(mailbox);
  const client = new google.auth.OAuth2();
  client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: client });
}

export async function listGmailMessageRefs(args: {
  mailbox: Mailbox;
  lookbackDays?: number;
  maxResults: number;
}) {
  const gmail = await getGmailClient(args.mailbox);
  const response = await gmail.users.messages.list({
    userId: "me",
    q: typeof args.lookbackDays === "number" ? `newer_than:${args.lookbackDays}d` : undefined,
    maxResults: args.maxResults,
  });

  return {
    refs: (response.data.messages ?? []).map((message) => ({
      remoteId: message.id ?? "",
      threadId: message.threadId ?? null,
    })),
    estimatedTotal: response.data.resultSizeEstimate ?? null,
  };
}

export async function getGmailMessage(args: {
  mailbox: Mailbox;
  remoteMessageId: string;
}) {
  const gmail = await getGmailClient(args.mailbox);
  const response = await gmail.users.messages.get({
    userId: "me",
    id: args.remoteMessageId,
    format: "full",
  });

  return parseGmailApiMessage(response.data);
}
