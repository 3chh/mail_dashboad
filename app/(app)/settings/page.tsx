import { Database, ShieldCheck, UserCog } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettingsData } from "@/lib/queries/app-data";
import { LogoutButton } from "@/components/settings/logout-button";

export default async function SettingsPage() {
  const admin = await getRequiredAdmin();
  const data = await getSettingsData(admin.id);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="rounded-[28px] border-border/70 bg-white/75">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Tài khoản quản trị
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Xác thực quản trị được tách khỏi OAuth của mailbox. Consent mailbox được xử lý riêng trên dashboard.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email quản trị</p>
            <p className="mt-3 text-sm">{data.adminUser?.email ?? "không có"}</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Vai trò</p>
            <p className="mt-3 text-sm">{data.adminUser?.role ?? "OPERATOR"}</p>
          </div>

        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-[28px] border-border/70 bg-white/75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Dữ liệu cục bộ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
              <span>Mailbox</span>
              <span className="font-medium text-foreground">{data.totals.mailboxes}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
              <span>Email</span>
              <span className="font-medium text-foreground">{data.totals.messages}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
              <span>OTP đã phát hiện</span>
              <span className="font-medium text-foreground">{data.totals.otps}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
              <span>Đơn hàng đã phát hiện</span>
              <span className="font-medium text-foreground">{data.totals.orders}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-white/75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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

