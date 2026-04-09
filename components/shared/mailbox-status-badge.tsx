import type { MailboxStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<MailboxStatus, string> = {
  DRAFT: "badge-status-draft",
  PENDING_CONSENT: "badge-status-pending",
  ACTIVE: "badge-status-active",
  ERROR: "badge-status-error",
  DISABLED: "badge-status-disabled",
  RECONNECT_REQUIRED: "badge-status-reconnect",
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
    <Badge variant="outline" className={cn("rounded-full font-semibold", styles[value])}>
      {labels[value]}
    </Badge>
  );
}
