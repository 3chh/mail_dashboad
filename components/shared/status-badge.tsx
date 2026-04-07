import type { ScanJobStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<ScanJobStatus, string> = {
  QUEUED: "bg-slate-100 text-slate-700 border-slate-200",
  RUNNING: "bg-sky-100 text-sky-700 border-sky-200",
  COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  FAILED: "bg-rose-100 text-rose-700 border-rose-200",
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
