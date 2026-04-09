"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivitySquare, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";

type ScanLog = {
  id: string;
  level: string;
  message: string;
  createdAt: string;
};

type ScanJob = {
  id: string;
  jobName: string | null;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  totalMessagesFound: number;
  scannedCount: number;
  otpDetectionsFound: number;
  orderExtractionsFound: number;
  createdAt: string;
  errorMessage: string | null;
  mailbox: {
    id: string;
    emailAddress: string;
    provider: "GMAIL" | "OUTLOOK";
  };
  logs: ScanLog[];
};

export function JobsClient({ initialJobs }: { initialJobs: ScanJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshJobs() {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/scan-jobs", { cache: "no-store" });
      const data = (await response.json()) as { jobs: ScanJob[] };
      setJobs(data.jobs);
    } finally {
      setIsRefreshing(false);
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
          <p className="mt-1 text-sm text-muted-foreground">Mỗi job đồng bộ gắn với một mailbox.</p>
        </div>
        <Button variant="outline" className="h-10 rounded-xl px-4 md:shrink-0" onClick={() => void refreshJobs()} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {jobs.map((job) => {
        const progress = job.totalMessagesFound > 0 ? (job.scannedCount / job.totalMessagesFound) * 100 : 0;

        return (
          <Card key={job.id} className="rounded-[28px] bg-card/88">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{job.jobName ?? "Job đồng bộ"}</h2>
                    <StatusBadge value={job.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {job.mailbox.emailAddress} - {job.mailbox.provider} - tạo {formatRelativeTime(job.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(job.createdAt)}</p>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>{job.scannedCount} mail đã lấy / </div>
                  <div>{job.totalMessagesFound || 0} tìm thấy</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tiến độ</span>
                  <span>
                    {job.scannedCount}/{job.totalMessagesFound || "?"}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {job.errorMessage ? (
                <div className="semantic-danger rounded-2xl border px-4 py-3 text-sm">
                  {job.errorMessage}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  {job.logs.map((log) => (
                    <div key={log.id} className="subpanel-surface rounded-2xl px-4 py-3">
                      <p className="text-sm font-medium">{log.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-start">
                  <Link href="/dashboard" className="control-surface rounded-2xl px-4 py-2 text-sm font-medium text-foreground transition">
                    Mở bảng điều khiển
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


