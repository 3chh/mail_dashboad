import type { ConfidenceLabel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<ConfidenceLabel, string> = {
  HIGH: "bg-emerald-100 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
};

const labels: Record<ConfidenceLabel, string> = {
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};

export function ConfidenceBadge({ value }: { value: ConfidenceLabel }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", styles[value])}>
      {labels[value]}
    </Badge>
  );
}
