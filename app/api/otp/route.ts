import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { MailboxStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { getOtpMonitorData } from "@/lib/queries/app-data";

const getOtpSchema = z
  .object({
    mailboxId: z.string().min(1).optional(),
    mailboxIds: z.array(z.string().min(1)).optional(),
    emailAddress: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  })
  .refine(
    (data) =>
      Boolean(data.mailboxId) ||
      Boolean(data.emailAddress) ||
      Boolean(data.mailboxIds?.length),
    {
      message: "Can cung cap mailboxId, mailboxIds hoac emailAddress.",
    },
  );

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

async function resolveOtpAccess(request: Request) {
  const expectedToken = process.env.OTP_API_TOKEN?.trim();
  const authHeader = request.headers.get("authorization");

  if (expectedToken && authHeader === `Bearer ${expectedToken}`) {
    return { adminUserId: null };
  }

  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  return admin ? { adminUserId: admin.id } : null;
}

export async function POST(request: Request) {
  const access = await resolveOtpAccess(request);

  if (!access) {
    return NextResponse.json({ error: "Khong co quyen truy cap." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = getOtpSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload lay OTP khong hop le." }, { status: 400 });
  }

  const requestedMailboxIds = uniqueValues([parsed.data.mailboxId, ...(parsed.data.mailboxIds ?? [])]);
  const requestedEmailAddresses = uniqueValues(
    Array.isArray(parsed.data.emailAddress) ? parsed.data.emailAddress : [parsed.data.emailAddress],
  ).map((emailAddress) => emailAddress.toLowerCase());

  const mailboxFilters = [
    ...(requestedMailboxIds.length > 0 ? [{ id: { in: requestedMailboxIds } }] : []),
    ...(requestedEmailAddresses.length > 0 ? [{ emailAddress: { in: requestedEmailAddresses } }] : []),
  ];

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      status: MailboxStatus.ACTIVE,
      AND: [
        ...(access.adminUserId
          ? [
              {
                OR: [{ createdById: access.adminUserId }, { createdById: null }],
              },
            ]
          : []),
        {
          OR: mailboxFilters,
        },
      ],
    },
    select: {
      id: true,
      emailAddress: true,
    },
  });

  if (mailboxes.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const otpResults = await getOtpMonitorData(mailboxes.map((mailbox) => mailbox.id));

  return NextResponse.json({
    results: otpResults.map((result) => ({
      mailboxId: result.mailbox?.id ?? null,
      emailAddress: result.mailbox?.emailAddress ?? null,
      code: result.latestCandidate?.code ?? null,
      confidenceScore: result.latestCandidate?.confidenceScore ?? null,
      confidenceLabel: result.latestCandidate?.confidenceLabel ?? null,
      subject: result.message?.subject ?? null,
      from: result.message?.fromHeader ?? null,
      receivedAt: result.message?.receivedAt?.toISOString() ?? null,
      contextSnippet: result.latestCandidate?.contextSnippet ?? null,
      candidateCount: result.candidateCount,
      error: result.errorMessage,
    })),
  });
}
