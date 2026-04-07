"use client";

import { useEffect, useMemo, useState } from "react";
import type { MailboxStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { MailboxStatusBadge } from "@/components/shared/mailbox-status-badge";
import { formatDateTime } from "@/lib/utils";

type MailboxRow = {
  id: string;
  emailAddress: string;
  displayName: string | null;
  provider: "GMAIL" | "OUTLOOK";
  status: string;
  lastSyncedAt: string | Date | null;
  lastError: string | null;
};

type DragMode = "select" | "deselect";

function normalizeMailboxSearch(value: string) {
  return value.trim().toLowerCase();
}

export function MailboxSelectionTable({
  mailboxes,
  selectedMailboxIds,
}: {
  mailboxes: MailboxRow[];
  selectedMailboxIds: string[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedMailboxIds);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [providerFilter, setProviderFilter] = useState<"ALL" | "GMAIL" | "OUTLOOK">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MailboxStatus>("ALL");

  useEffect(() => {
    setSelectedIds(selectedMailboxIds);
  }, [selectedMailboxIds]);

  useEffect(() => {
    function handleMouseUp() {
      setDragMode(null);
    }

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const filteredMailboxes = useMemo(() => {
    const normalizedSearch = normalizeMailboxSearch(searchTerm);

    return mailboxes.filter((mailbox) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        mailbox.emailAddress.toLowerCase().includes(normalizedSearch) ||
        (mailbox.displayName ?? "").toLowerCase().includes(normalizedSearch);
      const matchesProvider = providerFilter === "ALL" || mailbox.provider === providerFilter;
      const matchesStatus = statusFilter === "ALL" || mailbox.status === statusFilter;

      return matchesSearch && matchesProvider && matchesStatus;
    });
  }, [mailboxes, providerFilter, searchTerm, statusFilter]);

  function setMailboxSelection(mailboxId: string, shouldSelect: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (shouldSelect) {
        next.add(mailboxId);
      } else {
        next.delete(mailboxId);
      }
      return [...next];
    });
  }

  function toggleSelection(mailboxId: string, index: number, shiftKey: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (shiftKey && lastSelectedIndex != null) {
        const [start, end] = [lastSelectedIndex, index].sort((left, right) => left - right);
        const shouldSelect = !next.has(mailboxId);

        for (let cursor = start; cursor <= end; cursor += 1) {
          const targetId = filteredMailboxes[cursor]?.id;
          if (!targetId) {
            continue;
          }

          if (shouldSelect) {
            next.add(targetId);
          } else {
            next.delete(targetId);
          }
        }
      } else if (next.has(mailboxId)) {
        next.delete(mailboxId);
      } else {
        next.add(mailboxId);
      }

      return [...next];
    });

    setLastSelectedIndex(index);
  }

  function handleRowMouseDown(mailboxId: string, index: number, shiftKey: boolean) {
    if (shiftKey) {
      toggleSelection(mailboxId, index, true);
      return;
    }

    const shouldSelect = !selectedIds.includes(mailboxId);
    setMailboxSelection(mailboxId, shouldSelect);
    setLastSelectedIndex(index);
    setDragMode(shouldSelect ? "select" : "deselect");
  }

  function handleRowMouseEnter(mailboxId: string) {
    if (!dragMode) {
      return;
    }

    setMailboxSelection(mailboxId, dragMode === "select");
  }

  function selectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const mailbox of filteredMailboxes) {
        next.add(mailbox.id);
      }
      return [...next];
    });
  }

  function clearSelection() {
    setSelectedIds([]);
    setLastSelectedIndex(null);
    setDragMode(null);
  }

  return (
    <div className="space-y-3">
      {selectedIds.map((mailboxId) => (
        <input key={mailboxId} type="hidden" name="mailboxId" value={mailboxId} />
      ))}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Tìm theo email hoặc tên hiển thị"
          className="h-11 rounded-2xl"
        />
        <select
          value={providerFilter}
          onChange={(event) => setProviderFilter(event.target.value as "ALL" | "GMAIL" | "OUTLOOK")}
          className="h-11 rounded-2xl border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">Tất cả nhà cung cấp</option>
          <option value="GMAIL">Gmail</option>
          <option value="OUTLOOK">Hotmail / Outlook</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "ALL" | MailboxStatus)}
          className="h-11 rounded-2xl border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="PENDING_CONSENT">Chờ consent</option>
          <option value="RECONNECT_REQUIRED">Cần kết nối lại</option>
          <option value="ERROR">Lỗi</option>
          <option value="DISABLED">Đã tắt</option>
          <option value="DRAFT">Nháp</option>
        </select>
        <div className="flex items-center justify-end rounded-2xl border border-border/60 bg-background px-4 text-sm text-muted-foreground">
          {selectedIds.length} đã chọn / {filteredMailboxes.length} đang hiển thị
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="rounded-2xl" onClick={selectAllVisible}>
          Chọn tất cả đang hiển thị
        </Button>
        <Button type="button" variant="outline" className="rounded-2xl" onClick={clearSelection}>
          Bỏ chọn
        </Button>
      </div>

      <div className="rounded-[24px] border border-border/70 bg-background/70">
        <ScrollArea className="h-[380px] rounded-[24px]">
          <div className="min-w-[980px] select-none">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur [&_tr]:border-b [&_th]:bg-background/95">
                <TableRow>
                  <TableHead className="w-14 text-center">STT</TableHead>
                  <TableHead className="w-16 text-center">Chọn</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tên hiển thị</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Lần đồng bộ cuối</TableHead>
                  <TableHead>Lỗi gần nhất</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMailboxes.map((mailbox, index) => {
                  const selected = selectedIds.includes(mailbox.id);

                  return (
                    <TableRow
                      key={mailbox.id}
                      data-state={selected ? "selected" : undefined}
                      className={`cursor-default ${selected ? "bg-primary/5" : ""}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleRowMouseDown(mailbox.id, index, event.shiftKey);
                      }}
                      onMouseEnter={() => handleRowMouseEnter(mailbox.id)}
                    >
                      <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="text-center">
                        <input type="checkbox" checked={selected} readOnly className="pointer-events-none" />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{mailbox.emailAddress}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{mailbox.displayName || "-"}</TableCell>
                      <TableCell>
                        <ProviderBadge provider={mailbox.provider} />
                      </TableCell>
                      <TableCell>
                        <MailboxStatusBadge value={mailbox.status as MailboxStatus} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(mailbox.lastSyncedAt)}</TableCell>
                      <TableCell>
                        <div className="max-w-[240px] truncate text-sm text-rose-700">{mailbox.lastError || "-"}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}