import type { MailProvider } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<MailProvider, string> = {
  GMAIL: "bg-rose-50 text-rose-700 border-rose-200",
  OUTLOOK: "bg-sky-50 text-sky-700 border-sky-200",
};

export function ProviderBadge({ provider }: { provider: MailProvider }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", styles[provider])}>
      {provider === "GMAIL" ? "Gmail" : "Hotmail / Outlook"}
    </Badge>
  );
}
