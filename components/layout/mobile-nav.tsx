"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Bảng điều khiển" },
  { href: "/otp", label: "Lấy OTP" },
  { href: "/search", label: "Tìm kiếm" },
  { href: "/warehouses", label: "Kho" },
  { href: "/scan-jobs", label: "Đồng bộ" },
  { href: "/settings", label: "Cài đặt" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="no-scrollbar overflow-x-auto lg:hidden">
      <div className="flex min-w-max gap-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                active
                  ? "border-[color:var(--primary-border)] bg-[color:var(--primary-soft)] text-foreground shadow-[0_18px_36px_-28px_rgba(44,143,153,0.45)]"
                  : "border-border/70 bg-card/75 text-muted-foreground hover:bg-accent/80 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
