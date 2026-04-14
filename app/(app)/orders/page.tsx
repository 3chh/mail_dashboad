import { redirect } from "next/navigation";
import { appendMailboxSelectionParams, parseMailboxSelectionInput } from "@/lib/queries/mailbox-filter";

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function appendParam(params: URLSearchParams, key: string, value: string | string[] | undefined) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      params.append(key, item);
    }
    return;
  }

  params.set(key, value);
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const incoming = await searchParams;
  const params = new URLSearchParams();
  params.set("mode", "order");
  appendMailboxSelectionParams(
    params,
    parseMailboxSelectionInput({
      selectionMode: incoming.selectionMode,
      mailboxId: incoming.mailboxId,
      excludeMailboxId: incoming.excludeMailboxId,
    }),
  );

  appendParam(params, "keyword", incoming.keyword);
  appendParam(params, "sender", incoming.sender);
  appendParam(params, "dateFrom", incoming.dateFrom);
  appendParam(params, "dateTo", incoming.dateTo);
  appendParam(params, "lookbackDays", incoming.lookbackDays);
  appendParam(params, "withAttachments", incoming.withAttachments);
  appendParam(params, "unreadOnly", incoming.unreadOnly);

  redirect(`/search?${params.toString()}`);
}
