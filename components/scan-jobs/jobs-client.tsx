"use client";

import { useEffect, useState } from "react";
import { ActivitySquare, Loader2, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";

type ScanRunLog = {
  id: string;
  level: string;
  message: string;
  createdAt: string;
};

type ScanRunMailboxJob = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  scannedCount: number;
  savedCount: number;
  totalMessagesFound: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  mailbox: {
    id: string;
    emailAddress: string;
    provider: "GMAIL" | "OUTLOOK";
  };
};

type ScanRun = {
  id: string;
  batchId: string | null;
  jobName: string | null;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totalMailboxCount: number;
  completedMailboxCount: number;
  successMailboxCount: number;
  failedMailboxCount: number;
  totalSavedCount: number;
  jobs: ScanRunMailboxJob[];
  logs: ScanRunLog[];
};

function getProviderLabel(provider: "GMAIL" | "OUTLOOK") {
  return provider === "GMAIL" ? "Gmail" : "Hotmail / Outlook";
}

function isFinishedStatus(status: ScanRun["status"]) {
  return status === "COMPLETED" || status === "FAILED";
}

export function JobsClient({ initialJobs }: { initialJobs: ScanRun[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  async function refreshJobs() {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/scan-jobs", { cache: "no-store" });
      const data = (await response.json()) as { jobs: ScanRun[] };
      setJobs(data.jobs);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function deleteRunHistory(job: ScanRun) {
    if (!isFinishedStatus(job.status)) {
      toast.error("Chỉ có thể xóa lịch sử đã kết thúc.");
      return;
    }

    const confirmed = window.confirm(`Xóa lịch sử của "${job.jobName ?? "Luồng đồng bộ"}"? Dữ liệu mail đã đồng bộ vẫn được giữ nguyên.`);
    if (!confirmed) {
      return;
    }

    setDeletingRunId(job.id);

    try {
      const response = await fetch(`/api/scan-jobs/${job.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; deletedCount?: number } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "Không xóa được lịch sử đồng bộ.");
        return;
      }

      setJobs((currentJobs) => currentJobs.filter((currentJob) => currentJob.id !== job.id));
      toast.success(`Đã xóa ${payload?.deletedCount ?? 0} mục lịch sử đồng bộ.`);
    } finally {
      setDeletingRunId(null);
    }
  }

  async function deleteAllHistory() {
    const hasFinishedJobs = jobs.some((job) => isFinishedStatus(job.status));
    if (!hasFinishedJobs) {
      toast.error("Không có lịch sử đã kết thúc để xóa.");
      return;
    }

    const confirmed = window.confirm("Xóa toàn bộ lịch sử đồng bộ đã kết thúc? Dữ liệu mail đã đồng bộ vẫn được giữ nguyên.");
    if (!confirmed) {
      return;
    }

    setIsDeletingAll(true);

    try {
      const response = await fetch("/api/scan-jobs", {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; deletedCount?: number } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "Không xóa được lịch sử đồng bộ.");
        return;
      }

      setJobs((currentJobs) => currentJobs.filter((job) => !isFinishedStatus(job.status)));
      toast.success(`Đã xóa ${payload?.deletedCount ?? 0} mục lịch sử đồng bộ.`);
    } finally {
      setIsDeletingAll(false);
    }
  }

  useEffect(() => {
    const hasRunningJob = jobs.some((job) => job.status === "RUNNING" || job.status === "QUEUED");
    if (!hasRunningJob) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshJobs();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [jobs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ActivitySquare className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Lịch sử đồng bộ</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Button
            variant="destructive"
            className="h-10 rounded-xl px-4"
            onClick={() => void deleteAllHistory()}
            disabled={isDeletingAll}
          >
            {isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Xóa toàn bộ lịch sử
          </Button>
          <Button variant="outline" className="h-10 rounded-xl px-4" onClick={() => void refreshJobs()} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {jobs.map((job) => {
        const progress = job.totalMailboxCount > 0 ? (job.completedMailboxCount / job.totalMailboxCount) * 100 : 0;
        const isFinished = isFinishedStatus(job.status);
        const isDeletingThisRun = deletingRunId === job.id;

        return (
          <Card key={job.id} className="rounded-[28px] bg-card/88">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{job.jobName ?? "Lượt đồng bộ"}</h2>
                    <StatusBadge value={job.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Tạo {formatRelativeTime(job.createdAt)} - {job.totalMailboxCount} email đã chọn</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(job.createdAt)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Dialog>
                    <DialogTrigger
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-all outline-none hover:bg-accent/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                      title="Xem chi tiết"
                      aria-label="Xem chi tiết"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DialogTrigger>
                    <DialogContent className="panel-surface max-w-[min(42rem,calc(100%-2rem))] rounded-[28px] bg-card/95 p-0 sm:max-w-[42rem]">
                      <DialogHeader className="border-b border-border/70 px-6 py-5">
                        <DialogTitle>Chi tiết từng email</DialogTitle>
                        <DialogDescription>
                          {job.jobName ?? "Lượt đồng bộ"} - {job.successMailboxCount} thành công / {job.failedMailboxCount} lỗi
                        </DialogDescription>
                      </DialogHeader>

                      <div className="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
                        {job.jobs.map((mailboxJob) => (
                          <div key={mailboxJob.id} className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground">{mailboxJob.mailbox.emailAddress}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{getProviderLabel(mailboxJob.mailbox.provider)}</div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Đã đồng bộ: {mailboxJob.savedCount} mail - Đã quét: {mailboxJob.scannedCount}/{mailboxJob.totalMessagesFound || "?"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(mailboxJob.completedAt ?? mailboxJob.createdAt)}</div>
                                {mailboxJob.errorMessage ? <div className="mt-2 text-xs text-destructive">{mailboxJob.errorMessage}</div> : null}
                              </div>
                              <StatusBadge value={mailboxJob.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="destructive"
                    className="h-9 rounded-xl px-3"
                    onClick={() => void deleteRunHistory(job)}
                    disabled={!isFinished || isDeletingThisRun}
                    title={isFinished ? "Xóa lịch sử đồng bộ" : "Chỉ xóa được lịch sử đã kết thúc"}
                  >
                    {isDeletingThisRun ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Xóa
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tiến độ</span>
                  <span>
                    {job.completedMailboxCount}/{job.totalMailboxCount}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="space-y-2">
                {job.logs.map((log) => (
                  <div key={log.id} className="subpanel-surface rounded-2xl px-4 py-3">
                    <p className="text-sm font-medium">{log.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
