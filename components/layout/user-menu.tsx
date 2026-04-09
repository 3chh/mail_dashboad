"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { initialsFromName } from "@/lib/utils";

type UserMenuProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function UserMenu({ name, email, image }: UserMenuProps) {
  return (
    <div className="panel-surface flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2">
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
        <ThemeToggle />
        <Link
          href="/settings"
          className="control-surface inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-foreground transition hover:text-foreground"
        >
          <Settings className="mr-2 h-4 w-4" />
          Cài đặt
        </Link>
        <button
          type="button"
          className="semantic-danger inline-flex h-10 items-center rounded-xl border px-3 text-sm font-medium transition hover:brightness-110"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
