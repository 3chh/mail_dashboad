"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "B?ng ?i?u khi?n" },
  { href: "/otp", label: "L?y OTP" },
  { href: "/search", label: "T?m ki?m" },
  { href: "/scan-jobs", label: "??ng b?" },
  { href: "/settings", label: "C?i ??t" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto lg:hidden">
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
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white/70 text-muted-foreground",
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
