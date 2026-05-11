import { Wrench } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { OrderChecker } from "@/components/tools/order-checker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ToolsPage() {
  await getRequiredAdmin();

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88 !overflow-visible gap-2">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">
              Kiểm tra đơn hàng Pokemon Center
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <OrderChecker />
        </CardContent>
      </Card>
    </div>
  );
}
