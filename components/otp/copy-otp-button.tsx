"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyOtpButton({ code }: { code: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="rounded-xl"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        toast.success(`Đã sao chép mã ${code}`);
      }}
    >
      <Copy className="mr-2 h-3.5 w-3.5" />
      Sao chép
    </Button>
  );
}

