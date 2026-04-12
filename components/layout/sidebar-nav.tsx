"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChartColumn, MailSearch, Settings2, ShieldCheck, Workflow } from "lucide-react";
import { cn, initialsFromName } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Session } from "next-auth";

const navigation = [
  { href: "/dashboard", label: "Bảng điều khiển", icon: ChartColumn },
  { href: "/otp", label: "Lấy OTP", icon: ShieldCheck },
  { href: "/search", label: "Tìm kiếm", icon: MailSearch },
  { href: "/warehouses", label: "Kho", icon: Building2 },
  { href: "/scan-jobs", label: "Lịch sử đồng bộ", icon: Workflow },
  { href: "/settings", label: "Cài đặt", icon: Settings2 },
];

export function SidebarNav({ session }: { session: Session }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[320px] flex-col rounded-[28px] border border-sidebar-border/80 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--sidebar)_96%,black_4%),color-mix(in_oklab,var(--sidebar)_84%,var(--sidebar-accent)))] px-5 py-6 text-sidebar-foreground shadow-[0_34px_90px_-48px_rgba(0,8,16,0.8)] lg:flex">
      <div className="mb-10">
        <div className="flex items-center gap-3 p-2 group bg-sidebar-primary/5 rounded-[22px] border border-sidebar-primary/10 transition-all hover:bg-sidebar-primary/10">
          <Avatar className="h-10 w-10 ring-2 ring-sidebar-primary/20 ring-offset-2 ring-offset-sidebar transition-transform group-hover:scale-105">
            <AvatarImage src={session.user.image ?? undefined} />
            <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold">
              {initialsFromName(session.user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white tracking-tight">{session.user.name ?? "Quản trị viên"}</div>
            <div className="truncate text-[0.65rem] font-medium text-sidebar-foreground/60 leading-none mt-1 uppercase tracking-wider">Pilot</div>
          </div>
        </div>
        
        <div className="mt-8 px-2">
          <h1 className="text-xl font-bold tracking-tight text-white/90">Trung tâm Mailbox</h1>
        </div>
      </div>

      <nav className="space-y-2">
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition",
                active
                  ? "border-sidebar-primary/38 bg-sidebar-primary/22 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_44px_-30px_rgba(44,143,153,0.52)]"
                  : "border-transparent text-sidebar-foreground/78 hover:border-sidebar-border/55 hover:bg-sidebar-accent/92 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-sidebar-primary" : "text-sidebar-foreground/72")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
