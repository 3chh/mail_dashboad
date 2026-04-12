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
            <Select value={range} onValueChange={(value) => setRange(value ?? "7")}>
              <SelectTrigger id="sync-range" className="h-11 w-full rounded-2xl px-3 text-sm">
                <SelectValue>
                  {(value) => {
                    switch (value) {
                      case "1":
                        return "1 ngày gần đây";
                      case "7":
                        return "7 ngày gần đây";
                      case "30":
                        return "30 ngày gần đây";
                      default:
                        return "";
                    }
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 ngày gần đây</SelectItem>
                <SelectItem value="7">7 ngày gần đây</SelectItem>
                <SelectItem value="30">30 ngày gần đây</SelectItem>
              </SelectContent>
            </Select>
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
