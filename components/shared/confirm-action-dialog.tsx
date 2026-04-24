"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ConfirmVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  confirmVariant = "default",
  isPending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  isPending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="panel-surface sm:max-w-sm rounded-[28px] border-border/40 bg-card/95 pb-6" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground/90">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose
            render={<Button variant="outline" className="h-10 rounded-xl px-5 font-semibold transition-all" disabled={isPending} />}
          >
            {cancelLabel}
          </DialogClose>
          <Button
            variant={confirmVariant}
            className="h-10 rounded-xl px-5 font-semibold shadow-sm transition-all hover:brightness-110 active:scale-95"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
