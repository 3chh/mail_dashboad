import { getRequiredAdmin } from "@/lib/auth/get-session";
import { BitBrowserClient } from "@/lib/bitbrowser/client";

export async function GET() {
  await getRequiredAdmin();
  const bb = new BitBrowserClient();
  try {
    const groups = await bb.listGroups();
    return Response.json({ groups });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Lỗi lấy danh sách group" }, { status: 500 });
  }
}
