import type { MailProvider } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<MailProvider, string> = {
  GMAIL: "badge-provider-gmail",
  OUTLOOK: "badge-provider-outlook",
};

export function ProviderBadge({ provider }: { provider: MailProvider }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-semibold", styles[provider])}>
      {provider === "GMAIL" ? "Gmail" : "Hotmail / Outlook"}
    </Badge>
  );
}
