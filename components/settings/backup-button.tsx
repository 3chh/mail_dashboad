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
      const res = await fetch("/api/backup", {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Lỗi sao lưu dữ liệu");
      }
      
      toast.success(`Đã sao lưu dữ liệu vào tệp: ${data.fileName}`);
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
        <p className="text-sm text-muted-foreground mt-1">Lưu trữ database dưới dạng file dump</p>
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
        Sao lưu
      </Button>
    </div>
  );
}
