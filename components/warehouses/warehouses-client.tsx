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

type ParsedWarehouseInput = {
  name: string;
  address: string;
};

function parseWarehouseTextBlock(rawText: string) {
  const parsedWarehouses: ParsedWarehouseInput[] = [];
  const errors: string[] = [];

  for (const [index, rawLine] of rawText.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const postalMatch = line.match(/\d{3}-?\d{4}/);
    const postalIndex = postalMatch?.index;

    if (postalIndex == null) {
      errors.push(`Dòng ${lineNumber}: không tìm thấy mã bưu điện 7 chữ số.`);
      continue;
    }

    const name = line
      .slice(0, postalIndex)
      .replace(/\s+/g, " ")
      .trim();
    const address = line
      .slice(postalIndex)
      .replace(/\s+/g, " ")
      .trim();

    if (!name) {
      errors.push(`Dòng ${lineNumber}: không tìm thấy tên kho trước mã bưu điện.`);
      continue;
    }

    if (!address) {
      errors.push(`Dòng ${lineNumber}: không tìm thấy địa chỉ sau tên kho.`);
      continue;
    }

    parsedWarehouses.push({
      name,
      address,
    });
  }

  return {
    warehouses: parsedWarehouses,
    errors,
  };
}

export function WarehousesClient({ warehouses }: { warehouses: WarehouseRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [bulkText, setBulkText] = useState("");

  async function saveWarehouse(input: { name: string; address: string }) {
    const response = await fetch("/api/warehouses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    return {
      ok: response.ok,
      error: payload?.error ?? "Không lưu được kho.",
    };
  }

  async function createWarehouse() {
    startTransition(async () => {
      const result = await saveWarehouse({ name, address });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setName("");
      setAddress("");
      toast.success("Đã lưu thông tin kho.");
      router.refresh();
    });
  }

  async function createWarehousesFromText() {
    const { warehouses: parsedWarehouses, errors } = parseWarehouseTextBlock(bulkText);

    if (parsedWarehouses.length === 0) {
      toast.error(errors[0] ?? "Không parse được kho nào từ khối text.");
      return;
    }

    startTransition(async () => {
      let savedCount = 0;
      let failedCount = 0;

      for (const warehouse of parsedWarehouses) {
        const result = await saveWarehouse({
          name: warehouse.name,
          address: warehouse.address,
        });

        if (result.ok) {
          savedCount += 1;
        } else {
          failedCount += 1;
        }
      }

      if (savedCount > 0) {
        setBulkText("");
        router.refresh();
      }

      const notes: string[] = [];
      if (errors.length > 0) {
        notes.push(`${errors.length} dòng không hợp lệ bị bỏ qua`);
      }
      if (failedCount > 0) {
        notes.push(`${failedCount} kho lưu thất bại`);
      }

      if (savedCount > 0) {
        toast.success(
          notes.length > 0 ? `Đã lưu ${savedCount} kho. ${notes.join(". ")}.` : `Đã lưu ${savedCount} kho từ khối text.`,
        );
        return;
      }

      if (errors.length > 0) {
        toast.error(`Không lưu được kho nào. ${errors[0]}`);
        return;
      }

      toast.error("Không lưu được kho nào từ khối text.");
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
      <Card className="rounded-[28px] bg-card/88 gap-2">
        <CardHeader className="pb-1">
          <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Thêm kho đối chiếu</CardTitle>
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

      <Card className="rounded-[28px] bg-card/88 gap-2">
        <CardHeader className="pb-1">
          <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Thêm kho hàng loạt</CardTitle>
          <CardDescription>
            Mỗi dòng là 1 kho kèm địa chỉ tham chiếu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={`Ví dụ: Diệu\t3500821 / 川越市字福田 / 1002-1 /CASA川越 Re-born 303`}
            className="min-h-44 rounded-2xl font-mono text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <Button className="h-11 rounded-2xl" disabled={isPending || !bulkText.trim()} onClick={() => void createWarehousesFromText()}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Lưu danh sách kho
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] bg-card/88 gap-2">
        <CardHeader className="pb-1">
          <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Danh sách kho</CardTitle>
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
