import type { MailboxStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<MailboxStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PENDING_CONSENT: "bg-amber-50 text-amber-700 border-amber-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ERROR: "bg-rose-50 text-rose-700 border-rose-200",
  DISABLED: "bg-zinc-100 text-zinc-700 border-zinc-200",
  RECONNECT_REQUIRED: "bg-orange-50 text-orange-700 border-orange-200",
};

const labels: Record<MailboxStatus, string> = {
  DRAFT: "nháp",
  PENDING_CONSENT: "chờ consent",
  ACTIVE: "đang hoạt động",
  ERROR: "lỗi",
  DISABLED: "đã tắt",
  RECONNECT_REQUIRED: "cần kết nối lại",
};

export function MailboxStatusBadge({ value }: { value: MailboxStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", styles[value])}>
      {labels[value]}
    </Badge>
  );
}
