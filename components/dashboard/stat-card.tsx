import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

export function StatCard({ title, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card className="rounded-[28px] bg-card/88">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
          </div>
          <div className="icon-accent rounded-2xl p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
