import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { buildExcelWorkbook } from "@/lib/export/excel";
import { parseLookbackDays, parseSearchMode } from "@/lib/mail/query";
import { searchMailToolResults } from "@/lib/queries/app-data";
import { parseMailboxSelectionFromSearchParams, resolveMailboxSelection } from "@/lib/queries/mailbox-filter";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Khong co quyen truy cap." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = parseSearchMode(searchParams.get("mode"));
  const selection = await resolveMailboxSelection(admin.id, parseMailboxSelectionFromSearchParams(searchParams));

  const rows = await searchMailToolResults(
    selection.selectedMailboxIds,
    {
      keyword: searchParams.get("keyword") ?? undefined,
      sender: searchParams.get("sender") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      unreadOnly: searchParams.get("unreadOnly") === "true",
      withAttachments: searchParams.get("withAttachments") === "true",
      lookbackDays: parseLookbackDays(searchParams.get("lookbackDays"), 30),
      mode,
    },
    admin.id,
  );
  const sortedRows = [...rows].sort((left, right) => {
    const leftName = left.name?.trim();
    const rightName = right.name?.trim();
    const leftMissing = !leftName || leftName === "N/A";
    const rightMissing = !rightName || rightName === "N/A";

    if (leftMissing && rightMissing) {
      return left.to.localeCompare(right.to, "vi", { sensitivity: "base", numeric: true });
    }

    if (leftMissing) {
      return 1;
    }

    if (rightMissing) {
      return -1;
    }

    const byName = leftName.localeCompare(rightName, "vi", { sensitivity: "base", numeric: true });
    if (byName !== 0) {
      return byName;
    }

    return left.to.localeCompare(right.to, "vi", { sensitivity: "base", numeric: true });
  });

  const header =
    mode === "order"
      ? ["FROM", "NAME", "TO", "DATE", "WAREHOUSE", "TRACKING", "ADDRESS", "SUBJECT"]
      : ["FROM", "NAME", "TO", "DATE", "SUBJECT", "BODY"];

  const workbook = buildExcelWorkbook({
    sheetName: mode === "order" ? "Order Search" : "Body Search",
    headers: header,
    rows: sortedRows.map((row) =>
      mode === "order"
        ? [row.from, row.name, row.to, row.date, row.warehouse, row.tracking, row.address, row.subject]
        : [row.from, row.name, row.to, row.date, row.subject, row.body],
    ),
  });

  const filename = mode === "order" ? "ket-qua-don-hang.xls" : "ket-qua-body.xls";

  return new NextResponse(workbook, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
