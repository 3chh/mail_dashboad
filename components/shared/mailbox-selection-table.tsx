"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { formatDateTime } from "@/lib/utils";

import { ScrollArea } from "@/components/ui/scroll-area";

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
  initialSearchTerm = "",
  initialProviderFilter = "ALL",
  initialGroupFilter = "ALL",
  action,
}: {
  mailboxes: MailboxRow[];
  selectedMailboxIds: string[];
  initialSearchTerm?: string;
  initialProviderFilter?: "ALL" | "GMAIL" | "OUTLOOK";
  initialGroupFilter?: string;
  action?: ReactNode;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedMailboxIds);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [providerFilter, setProviderFilter] = useState<"ALL" | "GMAIL" | "OUTLOOK">(initialProviderFilter);
  const [groupFilter, setGroupFilter] = useState<string>(initialGroupFilter);

  useEffect(() => {
    setSelectedIds(selectedMailboxIds);
  }, [selectedMailboxIds]);

  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  useEffect(() => {
    setProviderFilter(initialProviderFilter);
  }, [initialProviderFilter]);

  useEffect(() => {
    setGroupFilter(initialGroupFilter);
  }, [initialGroupFilter]);

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
    <div className="min-w-0 space-y-3">
      {(() => {
        if (selectedIds.length === 0) {
          return <input type="hidden" name="selectionMode" value="none" />;
        }

        if (selectedIds.length === mailboxes.length) {
          return <input type="hidden" name="selectionMode" value="all" />;
        }

        if (selectedIds.length > mailboxes.length / 2) {
          const unselectedIds = mailboxes.map((mailbox) => mailbox.id).filter((id) => !selectedIds.includes(id));

          return (
            <>
              <input type="hidden" name="selectionMode" value="exclude" />
              <input type="hidden" name="excludeMailboxId" value={unselectedIds.join(",")} />
            </>
          );
        }

        return (
          <>
            <input type="hidden" name="selectionMode" value="include" />
            <input type="hidden" name="mailboxId" value={selectedIds.join(",")} />
          </>
        );
      })()}
      {/* Filters: Responsive flex layout that wraps on desktop, stacks on mobile */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {/* Search input: flexible width */}
        <div className="w-full flex-1 lg:min-w-[240px]">
          <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tìm kiếm</div>
          <Input
            name="mailboxSearch"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm theo email hoặc tên hiển thị"
            className="h-10 rounded-xl"
          />
        </div>
        {/* Provider + Group: side by side on mobile and tablet, stretch on desktop */}
        <div className="grid w-full grid-cols-2 gap-2 lg:w-auto lg:flex lg:flex-1 lg:gap-3">
          <div className="lg:min-w-[160px] lg:flex-1">
            <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Nhà cung cấp</div>
            <Select
              name="mailboxProvider"
              value={providerFilter}
              onValueChange={(value) => setProviderFilter((value ?? "ALL") as "ALL" | "GMAIL" | "OUTLOOK")}
            >
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
          <div className="lg:min-w-[140px] lg:flex-1">
            <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Nhóm</div>
            <Select name="mailboxGroup" value={groupFilter} onValueChange={(value) => setGroupFilter(value ?? "ALL")}>
              <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm">
                <SelectValue>{(value) => getGroupFilterLabel(value as string | null)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {availableGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Action buttons: side by side on mobile, stretch on desktop */}
        <div className="grid w-full grid-cols-2 gap-2 lg:w-auto lg:flex lg:flex-1 lg:gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-xl px-4 whitespace-nowrap lg:flex-1" onClick={selectAllVisible}>
            Chọn tất cả
          </Button>
          <Button type="button" variant="outline" className="h-10 rounded-xl px-4 whitespace-nowrap lg:flex-1" onClick={clearSelection}>
            Bỏ chọn
          </Button>
        </div>
        {/* Action slot (e.g. Lấy OTP button) */}
        {action ? (
          <div className="w-full lg:flex-1">{action}</div>
        ) : null}
      </div>

      <div className="text-sm text-muted-foreground">
        {selectedIds.length} / {filteredMailboxes.length} đã chọn
      </div>

      {/* Table: outer clips width, inner scrolls both axes */}
      <div className="subpanel-surface overflow-hidden rounded-[24px]">
        <ScrollArea className="h-[360px] no-scrollbar">
          <div className="min-w-[640px] select-none">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl [&_tr]:border-b [&_th]:bg-background/90">
                <TableRow>
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead className="w-14 text-center">Chọn</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Tên hiển thị</TableHead>
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
                      <TableCell className="text-center text-muted-foreground">{mailbox.displayName || "-"}</TableCell>
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

