import { NextResponse } from "next/server";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderOAuthCompletionPage(args: {
  success: boolean;
  provider: "gmail" | "outlook";
  message: string;
  mailboxEmail?: string | null;
}) {
  const title = args.success ? "K?t n?i mailbox th?nh c?ng" : "K?t n?i mailbox th?t b?i";
  const badge = args.provider === "gmail" ? "Gmail" : "Hotmail / Outlook";
  const html = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: Segoe UI, Arial, sans-serif; background: linear-gradient(180deg, #eff8f5 0%, #ffffff 100%); color: #17332f; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: min(520px, 100%); background: rgba(255,255,255,0.96); border: 1px solid rgba(23,51,47,0.12); border-radius: 28px; padding: 28px; box-shadow: 0 30px 90px -45px rgba(10,34,31,0.45); }
      .badge { display: inline-flex; align-items: center; border-radius: 999px; background: ${args.success ? "#dff5ea" : "#fde7e7"}; color: ${args.success ? "#0e6b45" : "#b42318"}; padding: 6px 12px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 18px 0 10px; font-size: 28px; line-height: 1.2; }
      p { margin: 0; font-size: 15px; line-height: 1.7; color: #45605b; }
      .meta { margin-top: 18px; padding: 14px 16px; border-radius: 18px; background: #f7faf9; border: 1px solid rgba(23,51,47,0.08); }
      .hint { margin-top: 18px; font-size: 13px; color: #5b726d; }
      .actions { margin-top: 22px; display: flex; gap: 12px; }
      button { appearance: none; border: 0; border-radius: 16px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
      button.primary { background: #17332f; color: white; }
      button.secondary { background: #eef3f2; color: #17332f; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="badge">${escapeHtml(badge)}</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(args.message)}</p>
        <div class="meta">
          <strong>Mailbox:</strong> ${escapeHtml(args.mailboxEmail ?? "N/A")}
        </div>
        <p class="hint">Tab n?y c? th? ??ng ngay sau khi ho?n t?t. N?u b?n m? t? b?ng ?i?u khi?n, tr?ng th?i ? tab g?c s? t? l?m m?i.</p>
        <div class="actions">
          <button class="primary" type="button" onclick="closeWindow()">??ng tab n?y</button>
          <button class="secondary" type="button" onclick="notifyAndStay()">L?m m?i tab g?c</button>
        </div>
      </div>
    </div>
    <script>
      function notifyParent() {
        try {
          localStorage.setItem("mailbox-consent-updated", String(Date.now()));
        } catch (error) {
          console.warn(error);
        }

        try {
          if ("BroadcastChannel" in window) {
            const channel = new BroadcastChannel("mailbox-consent");
            channel.postMessage({ type: "mailbox-consent-updated" });
            channel.close();
          }
        } catch (error) {
          console.warn(error);
        }

        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: "mailbox-consent-updated" }, "*");
          }
        } catch (error) {
          console.warn(error);
        }
      }

      function closeWindow() {
        notifyParent();
        window.close();
      }

      function notifyAndStay() {
        notifyParent();
      }

      notifyParent();
      setTimeout(() => {
        if (window.opener && !window.opener.closed) {
          window.close();
        }
      }, 800);
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
