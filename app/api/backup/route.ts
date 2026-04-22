import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  try {
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 10);
    const fileName = `mail_dashboard_${dateStr}.dump`;

    const command = `pg_dump -h localhost -U postgres -d mail_dashboard -Fc -f ${fileName}`;

    // Thêm các đường dẫn PostgreSQL phổ biến trên Mac (Homebrew, Postgres.app)
    const extraPaths = [
      "/Library/PostgreSQL/17/bin",
      "/usr/local/bin",
      "/Applications/Postgres.app/Contents/Versions/latest/bin",
    ].join(":");
    const currentPath = process.env.PATH || "";

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PGPASSWORD: "ZAQ!xsw2cde3",
        PATH: `${extraPaths}:${currentPath}`,
      },
    });

    return NextResponse.json({
      message: "Sao lưu thành công",
      fileName,
      stdout,
      stderr
    });
  } catch (error: any) {
    console.error("Backup failed:", error);
    return NextResponse.json({ error: "Sao lưu thất bại: " + error.message }, { status: 500 });
  }
}
