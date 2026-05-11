import { getRequiredAdmin } from "@/lib/auth/get-session";
import { runOrderChecks, parseAccounts, type SSEEvent } from "@/lib/pokemon-order/checker";

export const maxDuration = 300;

export async function POST(req: Request) {
  await getRequiredAdmin();

  const { accounts } = await req.json() as { accounts: string };

  if (!accounts?.trim()) {
    return Response.json({ error: "Không có tài khoản nào" }, { status: 400 });
  }

  try {
    parseAccounts(accounts);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  const otpUrl   = process.env.POKEMON_OTP_URL ?? "http://localhost:3000/api/otp";
  const otpKey   = process.env.OTP_API_TOKEN   ?? "";
  const omniHost = process.env.OMNILOGIN_HOST  ?? "http://localhost:35353";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      try {
        await runOrderChecks({ accounts, otpUrl, otpKey, omniHost, send });
      } catch (e: any) {
        send({ type: "log", label: "system", message: `Lỗi: ${e?.message ?? e}`, level: "error" });
      } finally {
        send({ type: "done" });
        controller.close();
      }
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
