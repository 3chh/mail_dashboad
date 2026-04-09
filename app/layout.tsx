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
  title: "Trung t?m Mailbox",
  description: "B?ng ?i?u khi?n qu?n tr? ?? onboarding Gmail v? Hotmail, ??ng b? d? li?u c?c b?, t?m ki?m mail v? l?y OTP.",
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
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_36%),radial-gradient(circle_at_80%_10%,_rgba(245,158,11,0.12),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(244,247,245,1))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(55,162,173,0.12),_transparent_30%),radial-gradient(circle_at_84%_12%,_rgba(82,127,196,0.08),_transparent_22%),radial-gradient(circle_at_50%_100%,_rgba(7,51,63,0.18),_transparent_42%),linear-gradient(180deg,_rgba(8,14,20,0.98),_rgba(12,18,26,1))]" />
            <div className="relative">{children}</div>
          </div>
          <Toaster richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
