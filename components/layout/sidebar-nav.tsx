"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChartColumn, MailSearch, Settings2, ShieldCheck, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "B?ng ?i?u khi?n", icon: ChartColumn },
  { href: "/otp", label: "L?y OTP", icon: ShieldCheck },
  { href: "/search", label: "T?m ki?m", icon: MailSearch },
  { href: "/warehouses", label: "Kho", icon: Building2 },
  { href: "/scan-jobs", label: "L?ch s? ??ng b?", icon: Workflow },
  { href: "/settings", label: "C?i ??t", icon: Settings2 },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 flex-col rounded-[28px] border border-sidebar-border/80 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--sidebar)_96%,black_4%),color-mix(in_oklab,var(--sidebar)_84%,var(--sidebar-accent)))] px-5 py-6 text-sidebar-foreground shadow-[0_34px_90px_-48px_rgba(0,8,16,0.8)] lg:flex">
      <div className="mb-10">
        <div className="inline-flex items-center rounded-full border border-sidebar-primary/24 bg-sidebar-primary/14 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sidebar-primary">
          Pilot
        </div>
        <div className="mt-4">
          <h1 className="text-2xl font-semibold">Trung t?m Mailbox</h1>
          <p className="mt-2 text-sm leading-6 text-sidebar-foreground/68">
            V?n h?nh t?p trung Gmail v? Hotmail ?? consent, ??ng b? c?c b?, ph?n nh?m mailbox v? ??i chi?u ??a ch? kho.
          </p>
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
