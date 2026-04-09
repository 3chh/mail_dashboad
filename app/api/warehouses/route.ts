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
    return NextResponse.json({ error: "Kh?ng c? quy?n truy c?p." }, { status: 401 });
  }

  const parsed = warehouseSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "D? li?u kho kh?ng h?p l?." }, { status: 400 });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: {
      name: parsed.data.name,
    },
    update: {
      address: parsed.data.address,
      normalizedAddress: normalizeWarehouseAddress(parsed.data.address),
    },
    create: {
      name: parsed.data.name,
      address: parsed.data.address,
      normalizedAddress: normalizeWarehouseAddress(parsed.data.address),
      createdById: admin.id,
    },
  });

  return NextResponse.json({ warehouse }, { status: 201 });
}
