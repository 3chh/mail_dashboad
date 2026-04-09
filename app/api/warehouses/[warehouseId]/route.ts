import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { normalizeWarehouseAddress } from "@/lib/utils";

const updateWarehouseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(500),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return resolveAdminFromSessionUser(session?.user);
}

export async function PATCH(request: Request, context: { params: Promise<{ warehouseId: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { warehouseId } = await context.params;
  const parsed = updateWarehouseSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu kho không hợp lệ." }, { status: 400 });
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      id: warehouseId,
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
  });

  if (!warehouse) {
    return NextResponse.json({ error: "Không tìm thấy kho." }, { status: 404 });
  }

  const updated = await prisma.warehouse.update({
    where: {
      id: warehouseId,
    },
    data: {
      name: parsed.data.name,
      address: parsed.data.address,
      normalizedAddress: normalizeWarehouseAddress(parsed.data.address),
    },
  });

  return NextResponse.json({ warehouse: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ warehouseId: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { warehouseId } = await context.params;
  const warehouse = await prisma.warehouse.findFirst({
    where: {
      id: warehouseId,
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
  });

  if (!warehouse) {
    return NextResponse.json({ error: "Không tìm thấy kho." }, { status: 404 });
  }

  await prisma.warehouse.delete({
    where: {
      id: warehouseId,
    },
  });

  return NextResponse.json({ ok: true });
}
