"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { formatDateTime } from "@/lib/utils";

type MailboxRow = {
  id: string;
  emailAddress: string;
  displayName: string | null;
  provider: "GMAIL" | "OUTLOOK";
  lastSyncedAt: string | Date | null;
  group?: {
    id: string;
    name: string;
  } | null;
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
  const [groupFilter, setGroupFilter] = useState<string>("ALL");

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

  const availableGroups = useMemo(() => {
    const map = new Map<string, string>();
    for (const mailbox of mailboxes) {
      if (mailbox.group?.id && mailbox.group?.name) {
        map.set(mailbox.group.id, mailbox.group.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [mailboxes]);

  function getProviderFilterLabel(value: string | null) {
    switch (value) {
      case "GMAIL":
        return "Gmail";
      case "OUTLOOK":
        return "Hotmail / Outlook";
      case "ALL":
      default:
        return "Tất cả";
    }
  }

  function getGroupFilterLabel(value: string | null) {
    if (!value || value === "ALL") {
      return "All";
    }

    return availableGroups.find((group) => group.id === value)?.name ?? value;
  }

  const filteredMailboxes = useMemo(() => {
    const normalizedSearch = normalizeMailboxSearch(searchTerm);

    return mailboxes.filter((mailbox) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        mailbox.emailAddress.toLowerCase().includes(normalizedSearch) ||
        (mailbox.displayName ?? "").toLowerCase().includes(normalizedSearch);
      const matchesProvider = providerFilter === "ALL" || mailbox.provider === providerFilter;
      const matchesGroup = groupFilter === "ALL" || mailbox.group?.id === groupFilter;

      return matchesSearch && matchesProvider && matchesGroup;
    });
  }, [groupFilter, mailboxes, providerFilter, searchTerm]);

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
      <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.82fr_0.82fr_auto_auto]">
        <div>
          <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tìm kiếm</div>
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm theo email hoặc tên hiển thị"
            className="h-10 rounded-xl"
          />
        </div>
        <div>
          <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Nhà cung cấp</div>
        <Select value={providerFilter} onValueChange={(value) => setProviderFilter((value ?? "ALL") as "ALL" | "GMAIL" | "OUTLOOK")}>
            <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm">
              <SelectValue>{(value) => getProviderFilterLabel(value as string | null)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả</SelectItem>
              <SelectItem value="GMAIL">Gmail</SelectItem>
              <SelectItem value="OUTLOOK">Hotmail / Outlook</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Nhóm</div>
        <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value ?? "ALL")}>
            <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm">
              <SelectValue>{(value) => getGroupFilterLabel(value as string | null)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả</SelectItem>
              {availableGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" className="h-10 rounded-xl px-3 whitespace-nowrap" onClick={selectAllVisible}>
          Chọn tất cả
        </Button>
        <Button type="button" variant="outline" className="h-10 rounded-xl px-3 whitespace-nowrap" onClick={clearSelection}>
          Bỏ chọn
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        {selectedIds.length} / {filteredMailboxes.length} đã chọn
      </div>

      <div className="subpanel-surface rounded-[24px]">
        <ScrollArea className="h-[360px] rounded-[24px]">
          <div className="min-w-[960px] select-none">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl [&_tr]:border-b [&_th]:bg-background/90">
                <TableRow>
                  <TableHead className="w-14 text-center">STT</TableHead>
                  <TableHead className="w-16 text-center">Chọn</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tên hiển thị</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Last sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMailboxes.map((mailbox, index) => {
                  const selected = selectedIds.includes(mailbox.id);

                  return (
                    <TableRow
                      key={mailbox.id}
                      data-state={selected ? "selected" : undefined}
                      className={selected ? "surface-selected" : ""}
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
                      <TableCell>{mailbox.group?.name ?? "All"}</TableCell>
                      <TableCell>
                        <ProviderBadge provider={mailbox.provider} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(mailbox.lastSyncedAt)}</TableCell>
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

