"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatabaseBackup, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function BackupButton() {
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      toast.info("Đang tạo bản sao lưu dữ liệu, vui lòng đợi trong giây lát...");

      const res = await fetch("/api/backup", {
        method: "POST",
      });

      if (!res.ok) {
        let errorMsg = "Lỗi sao lưu dữ liệu";
        try {
          const data = await res.json();
          if (data?.error) errorMsg = data.error;
        } catch {}
        throw new Error(errorMsg);
      }

      // Đọc tên file từ Content-Disposition header
      const disposition = res.headers.get("Content-Disposition");
      let fileName = `mail_dashboard_${new Date().toISOString().slice(0, 10)}.dump`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) {
          fileName = match[1];
        }
      }

      // Tạo Blob và kích hoạt tải về máy
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`Đã tải xuống tệp sao lưu: ${fileName}`);
    } catch (error: any) {
      toast.error(error.message || "Đã xảy ra lỗi khi sao lưu dữ liệu");
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="flex items-center justify-between subpanel-surface rounded-2xl p-4">
      <div className="space-y-0.5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sao lưu dữ liệu</p>
        <p className="text-sm text-muted-foreground mt-1">Xuất và tải về bản sao lưu database (.sql) về máy tính</p>
      </div>
      <Button 
        onClick={handleBackup} 
        disabled={isBackingUp}
        variant="outline"
        className="gap-2 rounded-xl"
      >
        {isBackingUp ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <DatabaseBackup className="h-4 w-4" />
        )}
        Sao lưu & Tải về
      </Button>
    </div>
  );
}
