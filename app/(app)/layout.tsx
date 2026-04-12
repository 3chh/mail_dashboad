import type { ReactNode } from "react";
import { getRequiredSession } from "@/lib/auth/get-session";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getRequiredSession();

  return (
    <div className="min-h-screen px-4 py-4 lg:px-6 lg:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4">
        <SidebarNav session={session} />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <MobileNav />
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
