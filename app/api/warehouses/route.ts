import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { normalizeWarehouseAddress } from "@/lib/utils";

const warehouseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const admin = await resolveAdminFromSessionUser(session?.user);

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const parsed = warehouseSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu kho không hợp lệ." }, { status: 400 });
  }

  const normalizedAddress = normalizeWarehouseAddress(parsed.data.address);

  const warehouse = await prisma.warehouse.upsert({
    where: {
      name_normalizedAddress: {
        name: parsed.data.name,
        normalizedAddress,
      },
    },
    update: {
      address: parsed.data.address,
      normalizedAddress,
    },
    create: {
      name: parsed.data.name,
      address: parsed.data.address,
      normalizedAddress,
      createdById: admin.id,
    },
  });

  return NextResponse.json({ warehouse }, { status: 201 });
}
