"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsFromName } from "@/lib/utils";

type UserMenuProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function UserMenu({ name, email, image }: UserMenuProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-white/70 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={image ?? undefined} alt={name ?? email ?? "Quản trị viên"} />
          <AvatarFallback>{initialsFromName(name ?? email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name ?? "Quản trị viên"}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted"
        >
          <Settings className="mr-2 h-4 w-4" />
          Cài đặt
        </Link>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
