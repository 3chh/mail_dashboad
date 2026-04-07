"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  Mail,
  MailSearch,
  ShieldCheck,
  Settings2,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Bảng điều khiển", icon: ChartColumn },
  { href: "/otp", label: "Lấy OTP", icon: ShieldCheck },
  { href: "/search", label: "Tìm kiếm", icon: MailSearch },
  { href: "/scan-jobs", label: "Lịch sử đồng bộ", icon: Workflow },
  { href: "/settings", label: "Cài đặt", icon: Settings2 },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 flex-col rounded-[28px] border border-sidebar-border/70 bg-sidebar px-5 py-6 text-sidebar-foreground shadow-[0_30px_90px_-35px_rgba(18,34,32,0.7)] lg:flex">
      <div className="mb-10">
        <div className="inline-flex items-center rounded-full bg-sidebar-primary/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sidebar-primary">
          Pilot
        </div>
        <div className="mt-4">
          <h1 className="text-2xl font-semibold">Trung tâm Mailbox</h1>
          <p className="mt-2 text-sm leading-6 text-sidebar-foreground/72">
            Vận hành tập trung Gmail và Hotmail để consent, đồng bộ cục bộ và thao tác theo từng mailbox.
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
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/10"
                  : "text-sidebar-foreground/78 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
