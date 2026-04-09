import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { createMailboxConsentUrl } from "@/lib/mail/consent-links";
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

  try {
    const consent = await createMailboxConsentUrl({
      adminUserId: admin.id,
      mailboxId,
    });

    return NextResponse.redirect(consent.url);
  } catch (error) {
    const message = error instanceof Error && error.message === "MAILBOX_NOT_FOUND" ? "mailbox-not-found" : "consent-link-failed";
    return NextResponse.redirect(buildPublicAppUrl(`/dashboard?error=${encodeURIComponent(message)}`));
  }
}
