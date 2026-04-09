import type { ReactNode } from "react";
import { getRequiredSession } from "@/lib/auth/get-session";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { StartScanDialog } from "@/components/layout/start-scan-dialog";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getRequiredSession();

  return (
    <div className="min-h-screen px-4 py-4 lg:px-6 lg:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4">
        <SidebarNav />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="panel-surface flex flex-col gap-4 rounded-[28px] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Quản lý mailbox tập trung</p>
              <h2 className="mt-2 text-2xl font-semibold">Bảng điều khiển Gmail và Hotmail</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StartScanDialog />
              <UserMenu name={session.user.name} email={session.user.email} />
            </div>
          </header>

          <MobileNav />

          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
