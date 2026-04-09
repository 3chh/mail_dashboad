import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { createMailboxConsentUrl } from "@/lib/mail/consent-links";

export async function POST(_request: Request, context: { params: Promise<{ mailboxId: string }> }) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  try {
    const { mailboxId } = await context.params;
    const consent = await createMailboxConsentUrl({
      adminUserId: admin.id,
      mailboxId,
    });

    return NextResponse.json(consent);
  } catch (error) {
    const message = error instanceof Error && error.message === "MAILBOX_NOT_FOUND" ? "Không tìm thấy mailbox." : "Không tạo được URL consent.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
