import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "vietnamese"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Trung tâm Mailbox",
  description: "Bảng điều khiển quản trị để onboarding Gmail và Hotmail, đồng bộ dữ liệu các hòm, tìm kiếm mail và lấy OTP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <div className="relative min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_36%),radial-gradient(circle_at_80%_10%,_rgba(245,158,11,0.12),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(244,247,245,1))] dark:bg-[radial-gradient(circle_at_18%_0%,_rgba(118,76,255,0.18),_transparent_32%),radial-gradient(circle_at_86%_8%,_rgba(224,74,255,0.12),_transparent_24%),radial-gradient(circle_at_52%_108%,_rgba(38,111,255,0.16),_transparent_40%),linear-gradient(180deg,_rgba(8,10,24,0.98),_rgba(12,14,32,1))]" />
            <div className="relative">{children}</div>
          </div>
          <Toaster richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
