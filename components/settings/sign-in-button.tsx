"use client";

import { useState, useTransition } from "react";
import { AlertCircle, LogIn, LogOut } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminSignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (!result || result.error || !result.ok) {
        const message = "Đăng nhập thất bại. Hãy kiểm tra lại tài khoản quản trị.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      toast.success("Đăng nhập thành công.");
      window.location.assign("/dashboard");
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="admin-email">Email</Label>
        <Input
          id="admin-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errorMessage) {
              setErrorMessage(null);
            }
          }}
          placeholder="admin@example.com"
          autoComplete="email"
          className="h-11 rounded-2xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-password">Mật khẩu</Label>
        <Input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errorMessage) {
              setErrorMessage(null);
            }
          }}
          placeholder="********"
          autoComplete="current-password"
          className="h-11 rounded-2xl"
        />
      </div>

      {errorMessage ? (
        <div className="semantic-danger flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="space-y-2">
        <Button className="h-12 w-full rounded-2xl" disabled={isPending || !email.trim() || !password} type="submit">
          <LogIn className="mr-2 h-4 w-4" />
          {isPending ? "Đang đăng nhập..." : "Đăng nhập quản trị"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-2xl text-white/90 hover:text-white"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Xóa session cũ
        </Button>
      </div>
    </form>
  );
}
