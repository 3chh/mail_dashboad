function normalizeBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, "") || null;
}

export function getPublicAppUrl() {
  return (
    normalizeBaseUrl(process.env.APP_PUBLIC_URL) ??
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ??
    normalizeBaseUrl(process.env.APP_URL) ??
    "http://localhost:3000"
  );
}

export function getInternalAppUrl() {
  return (
    normalizeBaseUrl(process.env.APP_INTERNAL_URL) ??
    normalizeBaseUrl(process.env.NEXTAUTH_URL_INTERNAL) ??
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ??
    getPublicAppUrl()
  );
}

export function getAppBaseUrl() {
  return getPublicAppUrl();
}

export function buildPublicAppUrl(pathname: string) {
  return new URL(pathname, `${getPublicAppUrl()}/`).toString();
}

export function buildInternalAppUrl(pathname: string) {
  return new URL(pathname, `${getInternalAppUrl()}/`).toString();
}