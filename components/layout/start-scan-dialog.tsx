"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StartScanDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState("7");
  const [isPending, startTransition] = useTransition();

  async function handleStartSync() {
    startTransition(async () => {
      const response = await fetch("/api/scan-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          syncWindowDays: Number(range),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Kh?ng th? b?t ??u ??ng b?.");
        return;
      }

      toast.success("?? x?p l?ch ??ng b? cho c?c mailbox ?ang ho?t ??ng.");
      setOpen(false);
      router.push("/scan-jobs");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_18px_40px_-24px_rgba(44,143,153,0.45)] transition hover:brightness-105">
        <Play className="mr-2 h-4 w-4" />
        ??ng b? mailbox ?ang ho?t ??ng
      </DialogTrigger>
      <DialogContent className="panel-surface rounded-[28px] bg-card/95">
        <DialogHeader>
          <DialogTitle>B?t ??u m?t l??t ??ng b?</DialogTitle>
          <DialogDescription>
            L??t n?y s? t?o job cho t?t c? mailbox ?ang ho?t ??ng v? ch? ??ng b? mail v? local store. T?m ki?m v? l?y OTP s? th?c hi?n ri?ng sau ??.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="sync-range" className="text-sm font-medium">
              Kho?ng th?i gian ??ng b?
            </label>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger id="sync-range" className="h-11 w-full rounded-2xl px-3 text-sm">
                <SelectValue>
                  {(value) => {
                    switch (value) {
                      case "1":
                        return "1 ng?y g?n ??y";
                      case "7":
                        return "7 ng?y g?n ??y";
                      case "30":
                        return "30 ng?y g?n ??y";
                      default:
                        return "";
                    }
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 ng?y g?n ??y</SelectItem>
                <SelectItem value="7">7 ng?y g?n ??y</SelectItem>
                <SelectItem value="30">30 ng?y g?n ??y</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="h-11 w-full rounded-2xl" onClick={handleStartSync} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            ??ng b? ngay
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
