import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { getOrdersData } from "@/lib/queries/app-data";
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
  const selection = await resolveMailboxSelection(
    admin.id,
    parseMultiValueParam(searchParams.getAll("mailboxId")),
  );

  const orders = await getOrdersData(selection.selectedMailboxIds, {
    sender: searchParams.get("sender") ?? undefined,
    merchant: searchParams.get("merchant") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    unreadOnly: searchParams.get("unreadOnly") === "true",
  });

  const header = [
    "mailbox",
    "order_id",
    "order_date",
    "merchant_name",
    "customer_name",
    "total_amount",
    "currency",
    "order_status",
    "item_summary",
    "source_subject",
    "source_sender",
    "received_time",
    "confidence",
  ];

  const rows = orders.map((order) =>
    [
      order.message.mailbox.emailAddress,
      order.orderId,
      order.orderDate?.toISOString() ?? "",
      order.merchantName,
      order.customerName,
      order.totalAmount,
      order.currency,
      order.orderStatus,
      order.itemSummary,
      order.sourceSubject,
      order.sourceSender,
      order.receivedAt?.toISOString() ?? "",
      order.confidenceLabel,
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="order-extractions.csv"',
    },
  });
}
