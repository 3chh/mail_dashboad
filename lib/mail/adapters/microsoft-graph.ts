import { MailProvider, Mailbox, MailboxStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseMicrosoftGraphMessage } from "@/lib/mail/parser";
import { getAppBaseUrl } from "@/lib/mail/oauth-helpers";
import { decryptSecret, encryptSecret } from "@/lib/mail/token-vault";

const MICROSOFT_AUTHORITY = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? "consumers"}/oauth2/v2.0`;

export const MICROSOFT_GRAPH_SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "User.Read",
  "Mail.Read",
];

function getAuthorizeUrl() {
  return `${MICROSOFT_AUTHORITY}/authorize`;
}

function getTokenUrl() {
  return `${MICROSOFT_AUTHORITY}/token`;
}

function getMicrosoftCallbackUrl() {
  return `${getAppBaseUrl()}/api/oauth/outlook/callback`;
}

async function readMicrosoftError(response: Response) {
  const raw = await response.text();

  try {
    const payload = JSON.parse(raw) as {
      error?: string;
      error_description?: string;
      error_codes?: number[];
    };
    const parts = [payload.error, payload.error_description, payload.error_codes?.length ? `codes=${payload.error_codes.join(",")}` : null].filter(Boolean);
    return parts.join(" | ") || raw || `HTTP ${response.status}`;
  } catch {
    return raw || `HTTP ${response.status}`;
  }
}

async function exchangeMicrosoftToken(params: URLSearchParams) {
  const response = await fetch(getTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const detail = await readMicrosoftError(response);
    throw new Error(`Trao đổi token Microsoft thất bại: ${detail}`);
  }

  return (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export function buildMicrosoftConsentUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: getMicrosoftCallbackUrl(),
    response_mode: "query",
    scope: MICROSOFT_GRAPH_SCOPES.join(" "),
    state,
    prompt: "select_account",
  });

  return `${getAuthorizeUrl()}?${params.toString()}`;
}

async function getGraphProfile(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await readMicrosoftError(response);
    throw new Error(`Yêu cầu hồ sơ Microsoft thất bại: ${detail}`);
  }

  return (await response.json()) as {
    id?: string;
    displayName?: string;
    mail?: string | null;
    userPrincipalName?: string | null;
  };
}

export async function exchangeMicrosoftCode(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    grant_type: "authorization_code",
    code,
    redirect_uri: getMicrosoftCallbackUrl(),
    scope: MICROSOFT_GRAPH_SCOPES.join(" "),
  });

  const token = await exchangeMicrosoftToken(params);
  const accessToken = token.access_token ?? null;

  if (!accessToken) {
    throw new Error("Thiếu access token Microsoft.");
  }

  const profile = await getGraphProfile(accessToken);

  return {
    externalUserId: profile.id ?? null,
    emailAddress: profile.mail?.toLowerCase() ?? profile.userPrincipalName?.toLowerCase() ?? null,
    displayName: profile.displayName ?? null,
    scopes: token.scope ?? MICROSOFT_GRAPH_SCOPES.join(" "),
    accessToken,
    refreshToken: token.refresh_token ?? null,
    tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
  };
}

async function refreshMicrosoftAccessToken(mailbox: Mailbox) {
  const refreshToken = decryptSecret(mailbox.refreshTokenEncrypted);

  if (!refreshToken) {
    throw new Error("Thiếu refresh token Microsoft.");
  }

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    redirect_uri: getMicrosoftCallbackUrl(),
    scope: MICROSOFT_GRAPH_SCOPES.join(" "),
  });

  const token = await exchangeMicrosoftToken(params);

  await prisma.mailbox.update({
    where: {
      id: mailbox.id,
    },
    data: {
      accessTokenEncrypted: token.access_token ? encryptSecret(token.access_token) : mailbox.accessTokenEncrypted,
      refreshTokenEncrypted: token.refresh_token ? encryptSecret(token.refresh_token) : mailbox.refreshTokenEncrypted,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : mailbox.tokenExpiresAt,
      grantedScopes: token.scope ?? mailbox.grantedScopes,
      lastError: null,
      status: MailboxStatus.ACTIVE,
    },
  });

  return token.access_token ?? decryptSecret(mailbox.accessTokenEncrypted);
}

export async function getMicrosoftAccessToken(mailbox: Mailbox) {
  if (mailbox.provider !== MailProvider.OUTLOOK) {
    throw new Error("Nhà cung cấp mailbox không khớp.");
  }

  const accessToken = decryptSecret(mailbox.accessTokenEncrypted);
  const expiresSoon = !mailbox.tokenExpiresAt || mailbox.tokenExpiresAt.getTime() <= Date.now() + 60_000;

  if (accessToken && !expiresSoon) {
    return accessToken;
  }

  const refreshed = await refreshMicrosoftAccessToken(mailbox);
  if (!refreshed) {
    throw new Error("Không thể làm mới access token Microsoft.");
  }

  return refreshed;
}

async function graphFetch(mailbox: Mailbox, path: string) {
  const accessToken = await getMicrosoftAccessToken(mailbox);
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="html"',
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await readMicrosoftError(response);
    throw new Error(`Yêu cầu Microsoft Graph thất bại: ${detail}`);
  }

  return response.json();
}

export async function listMicrosoftMessageRefs(args: {
  mailbox: Mailbox;
  lookbackDays: number;
  maxResults: number;
}) {
  const since = new Date(Date.now() - args.lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    "$top": String(args.maxResults),
    "$orderby": "receivedDateTime desc",
    "$filter": `receivedDateTime ge ${since}`,
    "$select": "id,conversationId",
  });
  const payload = (await graphFetch(
    args.mailbox,
    `/me/messages?${params.toString()}`,
  )) as {
    value?: Array<{ id?: string; conversationId?: string | null }>;
  };

  return {
    refs: (payload.value ?? []).map((message) => ({
      remoteId: message.id ?? "",
      threadId: message.conversationId ?? null,
    })),
    estimatedTotal: payload.value?.length ?? null,
  };
}

export async function getMicrosoftMessage(args: {
  mailbox: Mailbox;
  remoteMessageId: string;
}) {
  const payload = (await graphFetch(
    args.mailbox,
    `/me/messages/${args.remoteMessageId}?$select=id,conversationId,subject,bodyPreview,receivedDateTime,hasAttachments,isRead,categories,from,body,internetMessageHeaders`,
  )) as Parameters<typeof parseMicrosoftGraphMessage>[0];

  return parseMicrosoftGraphMessage(payload);
}
