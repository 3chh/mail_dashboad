import type { ScanJobStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<ScanJobStatus, string> = {
  QUEUED: "semantic-neutral",
  RUNNING: "semantic-info",
  COMPLETED: "semantic-success",
  FAILED: "semantic-danger",
};

const labels: Record<ScanJobStatus, string> = {
  QUEUED: "đang chờ",
  RUNNING: "đang quét",
  COMPLETED: "hoàn tất",
  FAILED: "thất bại",
};

export function StatusBadge({ value }: { value: ScanJobStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", styles[value])}>
      {labels[value]}
    </Badge>
  );
}
