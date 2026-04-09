"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type WarehouseRow = {
  id: string;
  name: string;
  address: string;
  updatedAt: string;
};

export function WarehousesClient({ warehouses }: { warehouses: WarehouseRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  async function createWarehouse() {
    startTransition(async () => {
      const response = await fetch("/api/warehouses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, address }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Không lưu được kho.");
        return;
      }

      setName("");
      setAddress("");
      toast.success("Đã lưu thông tin kho.");
      router.refresh();
    });
  }

  async function editWarehouse(warehouse: WarehouseRow) {
    const nextName = window.prompt("Tên kho", warehouse.name)?.trim();
    if (!nextName) {
      return;
    }

    const nextAddress = window.prompt("Địa chỉ đối chiếu", warehouse.address)?.trim();
    if (!nextAddress) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/warehouses/${warehouse.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: nextName, address: nextAddress }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Không cập nhật được kho.");
        return;
      }

      toast.success("Đã cập nhật kho.");
      router.refresh();
    });
  }

  async function deleteWarehouse(warehouse: WarehouseRow) {
    if (!window.confirm(`Xóa kho ${warehouse.name}?`)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/warehouses/${warehouse.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Không xóa được kho.");
        return;
      }

      toast.success("Đã xóa kho.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88">
        <CardHeader>
          <CardTitle>Quản lý kho đối chiếu</CardTitle>
          <CardDescription>
            Thêm dữ liệu kho:
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[0.7fr_1.5fr_auto]">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tên kho"
            className="h-11 rounded-2xl"
          />
          <Textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Địa chỉ tham chiếu"
            className="min-h-11 rounded-2xl"
          />
          <Button className="h-11 rounded-2xl" disabled={isPending || !name.trim() || !address.trim()} onClick={() => void createWarehouse()}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Lưu kho
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] bg-card/88">
        <CardHeader>
          <CardTitle>Danh sách kho</CardTitle>
          <CardDescription>{warehouses.length} kho đang được dùng để đối chiếu.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="subpanel-surface rounded-[24px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">STT</TableHead>
                  <TableHead>Tên kho</TableHead>
                  <TableHead>Địa chỉ đối chiếu</TableHead>
                  <TableHead className="w-40">Cập nhật</TableHead>
                  <TableHead className="w-36">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((warehouse, index) => (
                  <TableRow key={warehouse.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell className="text-sm leading-7 text-muted-foreground">{warehouse.address}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{warehouse.updatedAt}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => void editWarehouse(warehouse)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Sửa
                        </Button>
                        <Button type="button" variant="destructive" className="h-9 rounded-xl" onClick={() => void deleteWarehouse(warehouse)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
