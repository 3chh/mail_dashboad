"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
        toast.error(data?.error ?? "Không thể bắt đầu đồng bộ.");
        return;
      }

      toast.success("Đã xếp lịch đồng bộ cho các mailbox đang hoạt động.");
      setOpen(false);
      router.push("/scan-jobs");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90">
        <Play className="mr-2 h-4 w-4" />
        Đồng bộ mailbox đang hoạt động
      </DialogTrigger>
      <DialogContent className="rounded-[28px] border-border/70">
        <DialogHeader>
          <DialogTitle>Bắt đầu một lượt đồng bộ</DialogTitle>
          <DialogDescription>
            Lượt này sẽ tạo job cho tất cả mailbox đang hoạt động và chỉ đồng bộ mail về local store. Tìm kiếm và lấy OTP sẽ thực hiện riêng sau đó.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="sync-range" className="text-sm font-medium">
              Khoảng thời gian đồng bộ
            </label>
            <select
              id="sync-range"
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm"
            >
              <option value="1">1 ngày gần đây</option>
              <option value="7">7 ngày gần đây</option>
              <option value="30">30 ngày gần đây</option>
            </select>
          </div>

          <Button className="h-11 w-full rounded-2xl" onClick={handleStartSync} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Đồng bộ ngay
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
