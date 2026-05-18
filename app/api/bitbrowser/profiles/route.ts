import { getRequiredAdmin } from "@/lib/auth/get-session";
import { BitBrowserClient } from "@/lib/bitbrowser/client";

export async function GET(req: Request) {
  await getRequiredAdmin();
  const url = new URL(req.url);
  const groupId = url.searchParams.get("groupId");
  if (!groupId) return Response.json({ error: "Thiếu groupId" }, { status: 400 });

  const bb = new BitBrowserClient();
  try {
    const profiles = await bb.listProfiles(groupId);
    return Response.json({ profiles });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Lỗi lấy danh sách profile" }, { status: 500 });
  }
}
