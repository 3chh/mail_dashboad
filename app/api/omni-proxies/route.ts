import { getRequiredAdmin } from "@/lib/auth/get-session";
import { OmniLogin } from "@omnilogin/sdk";

export async function GET() {
  await getRequiredAdmin();

  const omniHost = process.env.OMNILOGIN_HOST ?? "http://localhost:35353";
  const omni = new OmniLogin({ host: omniHost, timeout: 30000 });

  try {
    // Fetch up to 200 proxies in one call
    const result = await omni.proxies.list({ page: 1, pageSize: 200 });
    return Response.json({ proxies: result.docs });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Không lấy được danh sách proxy" }, { status: 500 });
  }
}
