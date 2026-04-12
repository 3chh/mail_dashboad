"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="destructive"
            className="h-12 w-full rounded-2xl font-semibold shadow-sm transition-all hover:brightness-110 active:scale-95"
          />
        }
      >
        <LogOut className="mr-2 h-4 w-4" />
        Đăng xuất
      </DialogTrigger>
      <DialogContent className="panel-surface sm:max-w-xs rounded-[28px] border-border/40 bg-card/95 pb-6">
        <DialogHeader>
          <DialogTitle className="text-xl">Xác nhận thoát</DialogTitle>
          <DialogDescription className="text-muted-foreground/90">
            Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-6">
          <DialogClose render={<Button variant="ghost" className="h-10 rounded-xl px-5 font-semibold transition-all hover:bg-muted" />}>
            Hủy
          </DialogClose>
          <Button
            variant="destructive"
            className="h-10 rounded-xl px-5 font-semibold shadow-sm transition-all hover:brightness-110 active:scale-95"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            Đăng xuất
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
