import { getRequiredAdmin } from "@/lib/auth/get-session";
import { buildExcelWorkbook } from "@/lib/export/excel";
import { NextResponse } from "next/server";

type ResultRow = {
  profileName: string;
  email: string;
  stepLabel?: string;
  error?: string;
  success: boolean;
};

export async function POST(req: Request) {
  await getRequiredAdmin();

  const { results } = await req.json() as { results: ResultRow[] };

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "Không có kết quả" }, { status: 400 });
  }

  const workbook = buildExcelWorkbook({
    sheetName: "Pokemon Order Check",
    headers: ["Profile Name", "Email", "Kết quả"],
    rows: results.map((r) => [
      r.profileName,
      r.email,
      r.success ? (r.stepLabel ?? "Thành công") : `Lỗi: ${r.error ?? "Không xác định"}`,
    ]),
  });

  return new NextResponse(workbook, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ket-qua-pokemon.xls"',
    },
  });
}
