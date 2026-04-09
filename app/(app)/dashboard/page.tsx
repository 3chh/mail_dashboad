import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Database, Mail, ShieldCheck, ShoppingBag, Unplug } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { MailboxesClient } from "@/components/dashboard/mailboxes-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/queries/dashboard";
import { formatRelativeTime } from "@/lib/utils";

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type SummaryTone = "neutral" | "primary" | "warning" | "danger" | "output";

function toneClasses(tone: SummaryTone, highlighted = false) {
  if (tone === "primary") {
    return highlighted ? "tone-brand-strong" : "tone-brand";
  }

  if (tone === "warning") {
    return highlighted ? "tone-warning-strong" : "tone-warning";
  }

  if (tone === "danger") {
    return highlighted ? "tone-danger-strong" : "tone-danger";
  }

  if (tone === "output") {
    return highlighted ? "tone-info-strong" : "tone-info";
  }

  return highlighted ? "tone-neutral-strong" : "tone-neutral";
}

function SummaryMetric({
  title,
  value,
  hint,
  icon: Icon,
  tone,
  href,
  emphasized = false,
  trailing,
}: {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: SummaryTone;
  href?: string;
  emphasized?: boolean;
  trailing?: string;
}) {
  const inner = (
    <div className={`rounded-[18px] border px-3.5 py-3 transition ${toneClasses(tone, emphasized)} ${href ? "hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-26px_rgba(0,8,16,0.38)]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
          </div>
          <div className="mt-1.5 flex min-w-0 items-end gap-2">
            <p className={`shrink-0 leading-none font-semibold tracking-tight ${emphasized ? "text-[1.9rem]" : "text-[1.65rem]"}`}>{value}</p>
            <p className="min-w-0 truncate pb-0.5 text-[11px] leading-none text-muted-foreground">
              {trailing ? `${hint} ${trailing}` : hint}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/20 p-1.5 text-muted-foreground/75">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const admin = await getRequiredAdmin();
  const params = await searchParams;
  const data = await getDashboardData(admin.id);
  const connected = typeof params.connected === "string" ? params.connected : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const statusParam = typeof params.status === "string" ? params.status : "ALL";
  const initialStatusFilter = ["ACTIVE", "PENDING_CONSENT", "RECONNECT_REQUIRED", "ERROR", "DISABLED", "DRAFT"].includes(statusParam)
    ? (statusParam as "ACTIVE" | "PENDING_CONSENT" | "RECONNECT_REQUIRED" | "ERROR" | "DISABLED" | "DRAFT")
    : "ALL";

  const activePercent = data.stats.mailboxCount > 0 ? Math.round((data.stats.activeMailboxCount / data.stats.mailboxCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {connected ? (
        <Card className="alert-success rounded-[28px]">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <CheckCircle2 className="h-5 w-5" />
            Kết nối mailbox thành công qua {connected}.
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="alert-danger rounded-[28px]">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-3">
        <Card size="sm" className="rounded-[24px] bg-card/86">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-sm">Tổng quan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <SummaryMetric title="Tổng mailbox" value={String(data.stats.mailboxCount)} hint="Gmail + Hotmail" icon={Mail} tone="neutral" />
            <SummaryMetric
              title="Hoạt động"
              value={String(data.stats.activeMailboxCount)}
              trailing={`${activePercent}%`}
              hint={`${data.stats.activeMailboxCount} / ${data.stats.mailboxCount} active`}
              icon={Database}
              tone="primary"
              emphasized
            />
          </CardContent>
        </Card>

        <Card size="sm" className="rounded-[24px] bg-card/86">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-sm">Cảnh báo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <SummaryMetric
              title="Kết nối lại"
              value={String(data.stats.reconnectRequiredCount)}
              hint="Token hết hạn"
              icon={Unplug}
              tone="warning"
              href="/dashboard?status=RECONNECT_REQUIRED"
              emphasized={data.stats.reconnectRequiredCount > 0}
            />
            <SummaryMetric
              title="Mailbox lỗi"
              value={String(data.stats.errorMailboxCount)}
              hint="Lỗi OAuth"
              icon={AlertTriangle}
              tone="danger"
              href="/dashboard?status=ERROR"
              emphasized={data.stats.errorMailboxCount > 0}
            />
          </CardContent>
        </Card>

        <Card size="sm" className="rounded-[24px] bg-card/86">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-sm">Kết quả</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <SummaryMetric title="OTP" value={String(data.stats.otpsFound)} hint="Đã phát hiện" icon={ShieldCheck} tone="output" />
            <SummaryMetric title="Đơn hàng" value={String(data.stats.ordersFound)} hint="Đã trích xuất" icon={ShoppingBag} tone="output" />
          </CardContent>
        </Card>
      </section>

      <MailboxesClient
        groups={data.groups}
        mailboxes={data.mailboxes.map((mailbox) => ({
          ...mailbox,
          lastSyncedAt: mailbox.lastSyncedAt?.toISOString() ?? null,
        }))}
        initialStatusFilter={initialStatusFilter}
      />

      <Card className="rounded-[28px] bg-card/86">
        <CardHeader>
          <CardTitle>Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recentActivity.length > 0 ? (
            data.recentActivity.map((item) => (
              <div key={`${item.type}-${item.id}`} className="subpanel-surface rounded-2xl px-4 py-3">
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
