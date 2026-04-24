"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DaysInput } from "@/components/shared/days-input";

const SYNC_MIN_DAYS = 1;
const SYNC_MAX_DAYS = 30;

export function StartScanDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState("7");
  const [isPending, startTransition] = useTransition();

  async function handleStartSync() {
    const days = Number(range);
    if (!Number.isInteger(days) || days < SYNC_MIN_DAYS || days > SYNC_MAX_DAYS) {
      toast.error(`Số ngày phải từ ${SYNC_MIN_DAYS} đến ${SYNC_MAX_DAYS}.`);
      return;
    }
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
      <DialogTrigger className="glow-primary inline-flex h-11 items-center rounded-2xl bg-[#0d9488] px-5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]">
        <Play className="mr-2 h-4 fill-white w-4" />
        Đồng bộ mailbox đang hoạt động
      </DialogTrigger>
      <DialogContent className="panel-surface rounded-[28px] bg-card/95">
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
            <DaysInput
              value={range}
              onValueChange={setRange}
              min={SYNC_MIN_DAYS}
              max={SYNC_MAX_DAYS}
              className="h-11 rounded-2xl"
            />
            <p className="text-xs text-muted-foreground">Giới hạn: {SYNC_MIN_DAYS}–{SYNC_MAX_DAYS} ngày gần đây</p>
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
