DROP INDEX "Warehouse_name_key";

CREATE UNIQUE INDEX "Warehouse_name_normalizedAddress_key" ON "Warehouse"("name", "normalizedAddress");
