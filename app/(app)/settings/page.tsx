import { Building2, Database, ShieldCheck, UserCog } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettingsData } from "@/lib/queries/app-data";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function SettingsPage() {
  const admin = await getRequiredAdmin();
  const data = await getSettingsData(admin.id);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        {/* Left Column: Profile, System (Interface + Session) */}
        <Card className="rounded-[28px] bg-card/88 gap-2">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 font-sans !text-2xl font-semibold tracking-tight text-foreground">
              <UserCog className="h-5 w-5 text-primary" />
              Tài khoản quản trị
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="subpanel-surface rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email quản trị</p>
              <p className="mt-3 text-sm">{data.adminUser?.email ?? "không có"}</p>
            </div>
            <div className="subpanel-surface rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Vai trò</p>
              <p className="mt-3 text-sm">{data.adminUser?.role ?? "OPERATOR"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] bg-card/88 overflow-hidden gap-2">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 font-sans !text-2xl font-semibold tracking-tight text-foreground">
              <Building2 className="h-5 w-5 text-primary" />
              Hệ thống
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-6">
            <div className="flex items-center justify-between subpanel-surface rounded-2xl p-4">
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Chế độ hiển thị</p>
              </div>
              <ThemeToggle />
            </div>

            <div className="pt-2 border-t border-border/40">
              <LogoutButton />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {/* Right Column: Totals, Infrastructure info */}
        <Card className="rounded-[28px] bg-card/88 gap-2">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 font-sans !text-2xl font-semibold tracking-tight text-foreground">
              <Database className="h-5 w-5 text-primary" />
              Dữ liệu cục bộ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="subpanel-surface flex items-center justify-between rounded-2xl px-4 py-3">
              <span>Mailbox</span>
              <span className="font-medium text-foreground">{data.totals.mailboxes}</span>
            </div>
            <div className="subpanel-surface flex items-center justify-between rounded-2xl px-4 py-3">
              <span>Email</span>
              <span className="font-medium text-foreground">{data.totals.messages}</span>
            </div>
            <div className="subpanel-surface flex items-center justify-between rounded-2xl px-4 py-3">
              <span>OTP đã phát hiện</span>
              <span className="font-medium text-foreground">{data.totals.otps}</span>
            </div>
            <div className="subpanel-surface flex items-center justify-between rounded-2xl px-4 py-3">
              <span>Đơn hàng đã phát hiện</span>
              <span className="font-medium text-foreground">{data.totals.orders}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] bg-card/88 gap-2">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 font-sans !text-2xl font-semibold tracking-tight text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Mô hình token OAuth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>Mỗi Gmail / Hotmail cần consent 1 lần đầu để lấy refresh token.</p>
            <p>Refresh token được mã hóa trước khi lưu vào database.</p>
            <p>Tìm kiếm, lấy OTP và xem đơn hàng đều được trên local store sau khi đồng bộ, không fetch live mỗi request.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
