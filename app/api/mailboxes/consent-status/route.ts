import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

function buildNoStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return buildNoStoreJson({ error: "Khong co quyen truy cap." }, 401);
  }

  const ids = new URL(request.url)
    .searchParams.get("ids")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 100) ?? [];

  if (ids.length === 0) {
    return buildNoStoreJson({ mailboxes: [] });
  }

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      id: {
        in: ids,
      },
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
    select: {
      id: true,
      status: true,
    },
  });

  return buildNoStoreJson({ mailboxes });
}
