"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [bulkText, setBulkText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingAddress, setEditingAddress] = useState("");
  const [warehouseToDelete, setWarehouseToDelete] = useState<WarehouseRow | null>(null);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredWarehouses = normalizedSearchTerm
    ? warehouses.filter((warehouse) => warehouse.name.toLowerCase().includes(normalizedSearchTerm))
    : warehouses;

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
        toast.success(notes.length > 0 ? `Đã lưu ${savedCount} kho. ${notes.join(". ")}.` : `Đã lưu ${savedCount} kho từ khối text.`);
        return;
      }

      if (errors.length > 0) {
        toast.error(`Không lưu được kho nào. ${errors[0]}`);
        return;
      }

      toast.error("Không lưu được kho nào từ khối text.");
    });
  }

  function openEditWarehouse(warehouse: WarehouseRow) {
    setEditingWarehouse(warehouse);
    setEditingName(warehouse.name);
    setEditingAddress(warehouse.address);
  }

  function closeEditWarehouse() {
    setEditingWarehouse(null);
    setEditingName("");
    setEditingAddress("");
  }

  async function saveWarehouseEdits() {
    const warehouse = editingWarehouse;
    const nextName = editingName.trim();
    const nextAddress = editingAddress.trim();

    if (!warehouse || !nextName || !nextAddress) {
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

      closeEditWarehouse();
      toast.success("Đã cập nhật kho.");
      router.refresh();
    });
  }

  async function deleteWarehouse(warehouse: WarehouseRow) {
    startTransition(async () => {
      const response = await fetch(`/api/warehouses/${warehouse.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Không xóa được kho.");
        return;
      }

      setWarehouseToDelete(null);
      if (editingWarehouse?.id === warehouse.id) {
        closeEditWarehouse();
      }
      toast.success("Đã xóa kho.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88 gap-2">
        <CardHeader className="pb-1">
          <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Thêm kho hàng loạt</CardTitle>
          <CardDescription>Mỗi dòng là 1 kho kèm địa chỉ tham chiếu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={`Ví dụ: Diệu\t3500821 / 川越市字福田 / 1002-1 / CASA川越 Re-born 303`}
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
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm theo tên kho"
            className="mb-4 h-11 rounded-2xl"
          />
          <div className="subpanel-surface overflow-hidden rounded-[24px]">
            <ScrollArea className="h-[560px]">
              <div className="min-w-[960px]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl dark:bg-[linear-gradient(90deg,rgba(168,85,247,0.22),rgba(99,102,241,0.16),rgba(15,23,42,0.14))] [&_th]:bg-transparent">
                    <TableRow>
                      <TableHead className="w-16 pl-6">STT</TableHead>
                      <TableHead>Tên kho</TableHead>
                      <TableHead>Địa chỉ đối chiếu</TableHead>
                      <TableHead className="w-40">Cập nhật</TableHead>
                      <TableHead className="w-36">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWarehouses.map((warehouse, index) => (
                      <TableRow key={warehouse.id}>
                        <TableCell className="pl-6">{index + 1}</TableCell>
                        <TableCell className="font-medium">{warehouse.name}</TableCell>
                        <TableCell className="text-sm leading-7 text-muted-foreground">{warehouse.address}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{warehouse.updatedAt}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => openEditWarehouse(warehouse)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Sửa
                            </Button>
                            <Button type="button" variant="destructive" className="h-9 rounded-xl" onClick={() => setWarehouseToDelete(warehouse)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredWarehouses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Không tìm thấy kho phù hợp.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingWarehouse)}
        onOpenChange={(open) => {
          if (!open) {
            closeEditWarehouse();
          }
        }}
      >
        <DialogContent className="panel-surface rounded-[28px] border-border/40 bg-card/95 pb-6 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl">Cập nhật kho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} placeholder="Tên kho" className="h-11 rounded-2xl" />
            <Textarea
              value={editingAddress}
              onChange={(event) => setEditingAddress(event.target.value)}
              placeholder="Địa chỉ đối chiếu"
              className="min-h-28 rounded-2xl text-sm"
            />
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <DialogClose
              render={<Button variant="outline" className="h-10 rounded-xl px-5 font-semibold transition-all" disabled={isPending} />}
            >
              Hủy
            </DialogClose>
            <Button
              className="h-10 rounded-xl px-5 font-semibold shadow-sm transition-all hover:brightness-110 active:scale-95"
              disabled={isPending || !editingName.trim() || !editingAddress.trim()}
              onClick={() => void saveWarehouseEdits()}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Lưu thay đổi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={Boolean(warehouseToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setWarehouseToDelete(null);
          }
        }}
        title="Xóa kho"
        description={`Xóa kho "${warehouseToDelete?.name ?? ""}" khỏi danh sách đối chiếu?`}
        confirmLabel="Xóa kho"
        confirmVariant="destructive"
        isPending={isPending}
        onConfirm={() => {
          if (warehouseToDelete) {
            void deleteWarehouse(warehouseToDelete);
          }
        }}
      />
    </div>
  );
}
