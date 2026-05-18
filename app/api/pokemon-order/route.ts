import { getRequiredAdmin } from "@/lib/auth/get-session";
import { runOrderChecks, parseAccounts, type SSEEvent } from "@/lib/pokemon-order/checker";

export const maxDuration = 300;

export async function POST(req: Request) {
  await getRequiredAdmin();

  const body = await req.json() as {
    accounts: string;
    productCode: string;
    concurrency: number;
    threadProfileIds: string[]; // BitBrowser profile id cho mỗi luồng
  };

  const { accounts, productCode, concurrency, threadProfileIds } = body;

  if (!accounts?.trim()) {
    return Response.json({ error: "Không có tài khoản nào" }, { status: 400 });
  }
  if (!productCode?.trim()) {
    return Response.json({ error: "Chưa nhập mã sản phẩm" }, { status: 400 });
  }
  if (!concurrency || concurrency < 1) {
    return Response.json({ error: "Số luồng không hợp lệ" }, { status: 400 });
  }
  if (!Array.isArray(threadProfileIds) || threadProfileIds.length !== concurrency || threadProfileIds.some((p) => !p)) {
    return Response.json({ error: "Cần chọn profile cho mỗi luồng" }, { status: 400 });
  }

  try {
    parseAccounts(accounts);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  const otpUrl         = process.env.POKEMON_OTP_URL ?? "http://localhost:3000/api/otp";
  const otpKey         = process.env.OTP_API_TOKEN   ?? "";
  const bitBrowserHost = process.env.BITBROWSER_HOST ?? "http://127.0.0.1:54345";

  const encoder = new TextEncoder();
  const abort = new AbortController();

  req.signal?.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      try {
        await runOrderChecks({ accounts, productCode, concurrency, threadProfileIds, otpUrl, otpKey, bitBrowserHost, send, signal: abort.signal });
      } catch (e: any) {
        send({ type: "log", label: "system", message: `Lỗi: ${e?.message ?? e}`, level: "error" });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
