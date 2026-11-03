import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

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
  const fileName = `mail_dashboard_${timestamp}.dump`;
  const tempFilePath = path.join(os.tmpdir(), fileName);

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
    } catch {
      // Fallback giữ nguyên mặc định
    }

    const command = `pg_dump -h "${host}" -p "${port}" -U "${username}" -d "${database}" -Fc -f "${tempFilePath}"`;

    const extraPaths = [
      "/Library/PostgreSQL/17/bin",
      "/Library/PostgreSQL/16/bin",
      "/usr/local/bin",
      "/usr/bin",
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
      timeout: 120_000,
    });

    if (!fs.existsSync(tempFilePath)) {
      throw new Error("Không tạo được tệp sao lưu.");
    }

    const fileBuffer = fs.readFileSync(tempFilePath);

    // Xóa file tạm sau khi đã đọc vào buffer
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.warn("Lỗi dọn dẹp file tạm:", cleanupError);
    }

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {}
    }

    console.error("Backup failed:", error);
    return NextResponse.json(
      { error: "Sao lưu thất bại: " + (error?.message || "Lỗi không xác định") },
      { status: 500 }
    );
  }
}
