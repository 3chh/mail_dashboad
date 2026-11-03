import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

async function generateSqlBackup(): Promise<string> {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%' ORDER BY tablename;`
  );

  let sql = `-- Mailbox Center Database Backup (SQL Export)\n`;
  sql += `-- Generated at: ${new Date().toISOString()}\n\n`;
  sql += `SET statement_timeout = 0;\n`;
  sql += `SET client_encoding = 'UTF8';\n`;
  sql += `SET session_replication_role = 'replica';\n\n`;

  for (const { tablename } of tables) {
    const rows = await prisma.$queryRawUnsafe<Record<string, any>[]>(
      `SELECT * FROM "public"."${tablename}";`
    );

    if (!rows || rows.length === 0) continue;

    sql += `-- Table: public.${tablename} (${rows.length} rows)\n`;
    const columns = Object.keys(rows[0]);
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

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "Chưa cấu hình biến DATABASE_URL." }, { status: 500 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileNameBase = `mail_dashboard_${timestamp}`;
  const tempFilePath = path.join(os.tmpdir(), `${fileNameBase}.dump`);

  // 1. Thử chạy pg_dump nếu môi trường server có hỗ trợ
  try {
    let host = "localhost";
    let port = "5432";
    let username = "postgres";
    let password = "";
    let database = "mail_dashboard";

    try {
      const parsed = new URL(dbUrl);
      host = parsed.hostname || host;
      port = parsed.port || port;
      username = decodeURIComponent(parsed.username) || username;
      password = decodeURIComponent(parsed.password) || password;
      database = parsed.pathname.replace(/^\//, "").split("?")[0] || database;
    } catch {}

    const command = `pg_dump -h "${host}" -p "${port}" -U "${username}" -d "${database}" -Fc -f "${tempFilePath}"`;

    const extraPaths = [
      "/root/.nix-profile/bin",
      "/nix/var/nix/profiles/default/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/Library/PostgreSQL/17/bin",
      "/Library/PostgreSQL/16/bin",
      "/opt/homebrew/bin",
      "C:\\Program Files\\PostgreSQL\\17\\bin",
      "C:\\Program Files\\PostgreSQL\\16\\bin",
    ].join(path.delimiter);

    const currentPath = process.env.PATH || "";

    await execAsync(command, {
      env: {
        ...process.env,
        PGPASSWORD: password,
        PATH: `${extraPaths}${path.delimiter}${currentPath}`,
      },
      timeout: 60_000,
    });

    if (fs.existsSync(tempFilePath)) {
      const fileBuffer = fs.readFileSync(tempFilePath);
      try {
        fs.unlinkSync(tempFilePath);
      } catch {}

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${fileNameBase}.dump"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    }
  } catch (pgDumpError) {
    console.warn("pg_dump không khả dụng trên server, tự động chuyển sang xuất SQL trực tiếp:", pgDumpError);
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {}
    }
  }

  // 2. Dự phòng thông minh: Nếu server không có pg_dump (như Railway container), query trực tiếp và xuất file .sql
  try {
    const sqlContent = await generateSqlBackup();
    const sqlFileName = `${fileNameBase}.sql`;
    const buffer = Buffer.from(sqlContent, "utf-8");

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sqlFileName}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (fallbackError: any) {
    console.error("Lỗi xuất backup dự phòng:", fallbackError);
    return NextResponse.json(
      { error: "Sao lưu thất bại: " + (fallbackError?.message || "Lỗi không xác định") },
      { status: 500 }
    );
  }
}
