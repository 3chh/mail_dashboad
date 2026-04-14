import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { buildExcelWorkbook } from "@/lib/export/excel";
import { getOrdersData } from "@/lib/queries/app-data";
import { parseMailboxSelectionFromSearchParams, resolveMailboxSelection } from "@/lib/queries/mailbox-filter";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Khong co quyen truy cap." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const selection = await resolveMailboxSelection(admin.id, parseMailboxSelectionFromSearchParams(searchParams));

  const orders = await getOrdersData(selection.selectedMailboxIds, {
    sender: searchParams.get("sender") ?? undefined,
    merchant: searchParams.get("merchant") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    unreadOnly: searchParams.get("unreadOnly") === "true",
  });

  const workbook = buildExcelWorkbook({
    sheetName: "Orders",
    headers: [
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
    ],
    rows: orders.map((order) => [
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
    ]),
  });

  return new NextResponse(workbook, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": 'attachment; filename="order-extractions.xls"',
    },
  });
}
