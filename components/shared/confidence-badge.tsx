import type { ConfidenceLabel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<ConfidenceLabel, string> = {
  HIGH: "semantic-success",
  MEDIUM: "semantic-warning",
  LOW: "semantic-neutral",
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
