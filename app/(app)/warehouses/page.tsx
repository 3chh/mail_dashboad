import { getRequiredAdmin } from "@/lib/auth/get-session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";
import { WarehousesClient } from "@/components/warehouses/warehouses-client";

export default async function WarehousesPage() {
  const admin = await getRequiredAdmin();
  const warehouses = await prisma.warehouse.findMany({
    where: {
      OR: [{ createdById: admin.id }, { createdById: null }],
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <WarehousesClient
      warehouses={warehouses.map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name,
        address: warehouse.address,
        updatedAt: formatDateTime(warehouse.updatedAt),
      }))}
    />
  );
}
