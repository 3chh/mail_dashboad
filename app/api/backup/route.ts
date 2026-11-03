import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

// Chỉ sao lưu các bảng cốt lõi (Mailbox + Token + Admin + Groups + Warehouses)
// Bỏ qua hàng chục nghìn dòng logs/messages để sao lưu tức thì và không làm nghẽn server
const CORE_TABLES = [
  "AdminUser",
  "MailboxGroup",
  "Warehouse",
  "Mailbox",
  "MailboxOAuthState",
];

async function generateCoreBackup(): Promise<string> {
  let sql = `-- =====================================================================\n`;
  sql += `-- Mailbox Center: Bản sao lưu cốt lõi (Core Credentials & Mailboxes)\n`;
  sql += `-- Tạo lúc: ${new Date().toISOString()}\n`;
  sql += `-- Mục đích: Giữ nguyên vẹn 500+ Mailbox & Token để không phải kết nối lại\n`;
  sql += `-- =====================================================================\n\n`;
  sql += `SET statement_timeout = 0;\n`;
  sql += `SET client_encoding = 'UTF8';\n`;
  sql += `SET session_replication_role = 'replica';\n\n`;

  for (const tablename of CORE_TABLES) {
    const columnsInfo = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tablename}' ORDER BY ordinal_position;`
    );
    const columns = columnsInfo.map((c) => c.column_name);

    if (columns.length === 0) continue;

    const rows = await prisma.$queryRawUnsafe<Record<string, any>[]>(
      `SELECT * FROM "public"."${tablename}";`
    );

    if (!rows || rows.length === 0) continue;

    sql += `-- Bảng: public."${tablename}" (${rows.length} bản ghi)\n`;
    const quotedColumns = columns.map((c) => `"${c}"`).join(", ");

    for (const row of rows) {
      const values = columns.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
        if (typeof val === "number") return val.toString();
        if (val instanceof Date) return `'${val.toISOString()}'`;
        if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO "public"."${tablename}" (${quotedColumns}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;\n`;
    }
    sql += `\n`;
  }

  sql += `SET session_replication_role = 'origin';\n`;
  return sql;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sqlFileName = `mailbox_core_backup_${timestamp}.sql`;

    const sqlContent = await generateCoreBackup();
    const buffer = Buffer.from(sqlContent, "utf-8");

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sqlFileName}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Core backup failed:", error);
    return NextResponse.json(
      { error: "Sao lưu thất bại: " + (error?.message || "Lỗi không xác định") },
      { status: 500 }
    );
  }
}
