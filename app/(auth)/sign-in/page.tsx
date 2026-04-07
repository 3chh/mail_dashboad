import { redirect } from "next/navigation";
import { KeyRound, Mail, ShieldCheck, Workflow } from "lucide-react";
import { AdminSignInForm } from "@/components/settings/sign-in-button";
import { getOptionalAdmin } from "@/lib/auth/get-session";

const missingEnv = !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.NEXTAUTH_SECRET;

export default async function SignInPage() {
  const admin = await getOptionalAdmin();

  if (admin) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-12">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[36px] border border-border/70 bg-white/80 p-8 shadow-[0_30px_80px_-45px_rgba(18,40,38,0.45)] backdrop-blur md:p-12">
          <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-primary">
            Vận hành mailbox
          </div>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-tight text-balance">
            Trung tâm điều khiển cho Gmail và Hotmail để consent.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
            Quản trị viên đăng nhập vào web app, onboarding từng mailbox một lần để lấy refresh token, sau đó server đồng bộ theo lịch và tìm kiếm trên local store.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: KeyRound, title: "Xác thực quản trị", text: "Đăng nhập bằng tài khoản hệ thống, không dùng Google login làm xác thực chính." },
              { icon: Mail, title: "Onboarding mailbox", text: "Kết nối từng Gmail và Hotmail để lưu refresh token sau lần consent đầu tiên." },
              { icon: Workflow, title: "Đồng bộ theo lịch", text: "Đồng bộ mail về local store, rồi tìm kiếm và lấy OTP từ dữ liệu đã lưu." },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-border/70 bg-background/80 p-5">
                <item.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[36px] border border-border/70 bg-[#163330] p-8 text-white shadow-[0_30px_90px_-45px_rgba(13,35,33,0.8)] md:p-10">
          <div className="flex items-center gap-3 text-sm text-white/70">
            <ShieldCheck className="h-4 w-4" />
            Chỉ dành cho quản trị viên
          </div>

          <div className="mt-8 space-y-4">
            <h2 className="text-3xl font-semibold leading-tight">Đăng nhập bằng tài khoản quản trị</h2>
            <p className="text-sm leading-7 text-white/70">
              Consent mailbox sẽ được thực hiện riêng cho từng Gmail và Hotmail sau khi quản trị viên vào bảng điều khiển.
            </p>
          </div>

          {missingEnv ? (
            <div className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-300/12 p-4 text-sm leading-6 text-amber-50">
              Hãy cấu hình `ADMIN_EMAIL`, `ADMIN_PASSWORD`, và `NEXTAUTH_SECRET` trong `.env` trước khi đăng nhập.
            </div>
          ) : null}

          <div className="mt-8">
            <AdminSignInForm />
          </div>
        </section>
      </div>
    </div>
  );
}
