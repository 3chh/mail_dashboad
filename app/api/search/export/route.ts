import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { parseLookbackDays, parseSearchMode } from "@/lib/mail/query";
import { searchMailToolResults } from "@/lib/queries/app-data";
import { parseMultiValueParam, resolveMailboxSelection } from "@/lib/queries/mailbox-filter";

function csvEscape(value: string | number | null | undefined) {
  if (value == null) {
    return "";
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = parseSearchMode(searchParams.get("mode"));
  const selection = await resolveMailboxSelection(
    admin.id,
    parseMultiValueParam(searchParams.getAll("mailboxId")),
  );

  const rows = await searchMailToolResults(selection.selectedMailboxIds, {
    keyword: searchParams.get("keyword") ?? undefined,
    sender: searchParams.get("sender") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    unreadOnly: searchParams.get("unreadOnly") === "true",
    withAttachments: searchParams.get("withAttachments") === "true",
    lookbackDays: parseLookbackDays(searchParams.get("lookbackDays"), 30),
    mode,
  });

  const header =
    mode === "order"
      ? ["FROM", "NAME", "TO", "DATE", "WAREHOUSE", "TRACKING", "ADDRESS", "SUBJECT"]
      : ["FROM", "NAME", "TO", "DATE", "SUBJECT", "BODY"];

  const csvRows = rows.map((row) => {
    const values =
      mode === "order"
        ? [row.from, row.name, row.to, row.date, row.warehouse, row.tracking, row.address, row.subject]
        : [row.from, row.name, row.to, row.date, row.subject, row.body];

    return values.map(csvEscape).join(",");
  });

  const filename = mode === "order" ? "ket-qua-don-hang.csv" : "ket-qua-body.csv";
  const csv = `\uFEFF${[header.join(","), ...csvRows].join("\n")}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}