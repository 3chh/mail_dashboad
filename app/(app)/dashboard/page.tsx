import { AlertTriangle, CheckCircle2, Database, Mail, ShieldCheck, ShoppingBag, Unplug } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { StatCard } from "@/components/dashboard/stat-card";
import { OverviewCharts } from "@/components/dashboard/overview-charts";
import { MailboxesClient } from "@/components/dashboard/mailboxes-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/queries/dashboard";
import { formatRelativeTime } from "@/lib/utils";

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const admin = await getRequiredAdmin();
  const params = await searchParams;
  const data = await getDashboardData(admin.id);
  const connected = typeof params.connected === "string" ? params.connected : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="space-y-4">
      {connected ? (
        <Card className="rounded-[28px] border-emerald-200 bg-emerald-50/80">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            Kết nối mailbox thành công qua {connected}.
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="rounded-[28px] border-rose-200 bg-rose-50/80">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-800">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      <MailboxesClient
        mailboxes={data.mailboxes.map((mailbox) => ({
          ...mailbox,
          lastSyncedAt: mailbox.lastSyncedAt?.toISOString() ?? null,
        }))}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Tổng mailbox" value={String(data.stats.mailboxCount)} hint="Gmail + Hotmail đang quản lý" icon={Mail} />
        <StatCard title="Mailbox hoạt động" value={String(data.stats.activeMailboxCount)} hint="Đã consent và sẵn sàng đồng bộ" icon={Database} />
        <StatCard title="Cần kết nối lại" value={String(data.stats.reconnectRequiredCount)} hint="Token cần cấp lại consent" icon={Unplug} />
        <StatCard title="Mailbox lỗi" value={String(data.stats.errorMailboxCount)} hint="Cần kiểm tra kết nối hoặc OAuth" icon={AlertTriangle} />
        <StatCard title="OTP cục bộ" value={String(data.stats.otpsFound)} hint="Được phát hiện từ dữ liệu đã lưu" icon={ShieldCheck} />
        <StatCard title="Đơn hàng cục bộ" value={String(data.stats.ordersFound)} hint="Được rút trích từ email cục bộ" icon={ShoppingBag} />
      </section>

      <OverviewCharts
        emailsByDay={data.charts.emailsByDay}
        otpsByDay={data.charts.otpsByDay}
        ordersByDay={data.charts.ordersByDay}
      />

      <Card className="rounded-[28px] border-border/70 bg-white/75">
        <CardHeader>
          <CardTitle>Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recentActivity.length > 0 ? (
            data.recentActivity.map((item) => (
              <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-border/60 bg-background/75 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.type}</div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatRelativeTime(item.timestamp)}</p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
              Chưa có hoạt động nào. Hãy thêm mailbox và chạy đồng bộ thử nghiệm.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
