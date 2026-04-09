"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  FolderPlus,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { MailboxStatus } from "@prisma/client";
import { MailboxStatusBadge } from "@/components/shared/mailbox-status-badge";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

type GroupRow = {
  id: string;
  name: string;
  mailboxCount: number;
};

type MailboxGroupRef = {
  id: string;
  name: string;
};

type MailboxRow = {
  id: string;
  emailAddress: string;
  displayName: string | null;
  provider: "GMAIL" | "OUTLOOK";
  status: MailboxStatus;
  group: MailboxGroupRef | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  messageCount: number;
  jobCount: number;
};

type DragMode = "select" | "deselect";

function normalizeMailboxSearch(value: string) {
  return value.trim().toLowerCase();
}

export function MailboxesClient({
  groups,
  mailboxes,
  initialStatusFilter = "ALL",
}: {
  groups: GroupRow[];
  mailboxes: MailboxRow[];
  initialStatusFilter?: "ALL" | MailboxStatus;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [isPending, startTransition] = useTransition();
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [provider, setProvider] = useState<"GMAIL" | "OUTLOOK">("GMAIL");
  const [syncWindowDays, setSyncWindowDays] = useState("7");
  const [searchTerm, setSearchTerm] = useState("");
  const [providerFilter, setProviderFilter] = useState<"ALL" | "GMAIL" | "OUTLOOK">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MailboxStatus>(initialStatusFilter);
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("ALL");
  const [newGroupName, setNewGroupName] = useState("");
  const [busyMailboxId, setBusyMailboxId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [editingMailboxId, setEditingMailboxId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editGroupId, setEditGroupId] = useState<string>("ALL");
  const [editNewGroupName, setEditNewGroupName] = useState("");

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    function handleMouseUp() {
      setDragMode(null);
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-mailbox-action-menu]")) {
        setOpenActionMenuId(null);
      }
    }

    function handleConsentComplete() {
      setBusyMailboxId(null);
      setOpenActionMenuId(null);
      router.refresh();
    }

    function handleConsentStorage(event: StorageEvent) {
      if (event.key === "mailbox-consent-updated") {
        handleConsentComplete();
      }
    }

    function handleConsentMessage(event: MessageEvent) {
      if (event.data?.type === "mailbox-consent-updated") {
        handleConsentComplete();
      }
    }

    const channel = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("mailbox-consent") : null;
    channel?.addEventListener("message", handleConsentComplete);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("storage", handleConsentStorage);
    window.addEventListener("message", handleConsentMessage);
    window.addEventListener("focus", handleConsentComplete);

    return () => {
      channel?.removeEventListener("message", handleConsentComplete);
      channel?.close();
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("storage", handleConsentStorage);
      window.removeEventListener("message", handleConsentMessage);
      window.removeEventListener("focus", handleConsentComplete);
    };
  }, [router]);

  const normalizedSearch = normalizeMailboxSearch(searchTerm);
  const filteredMailboxes = useMemo(
    () =>
      mailboxes.filter((mailbox) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          mailbox.emailAddress.toLowerCase().includes(normalizedSearch) ||
          (mailbox.displayName ?? "").toLowerCase().includes(normalizedSearch);
        const matchesProvider = providerFilter === "ALL" || mailbox.provider === providerFilter;
        const matchesStatus = statusFilter === "ALL" || mailbox.status === statusFilter;
        const matchesGroup = groupFilter === "ALL" || mailbox.group?.id === groupFilter;

        return matchesSearch && matchesProvider && matchesStatus && matchesGroup;
      }),
    [groupFilter, mailboxes, normalizedSearch, providerFilter, statusFilter],
  );

  const editingMailbox = useMemo(
    () => mailboxes.find((mailbox) => mailbox.id === editingMailboxId) ?? null,
    [editingMailboxId, mailboxes],
  );

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
    setSelectedIds(filteredMailboxes.map((mailbox) => mailbox.id));
  }

  function clearSelection() {
    setSelectedIds([]);
    setLastSelectedIndex(null);
    setDragMode(null);
  }

  function beginEditMailbox(mailbox: MailboxRow) {
    setEditingMailboxId(mailbox.id);
    setEditDisplayName(mailbox.displayName ?? "");
    setEditGroupId(mailbox.group?.id ?? "ALL");
    setEditNewGroupName("");
  }

  function cancelEditMailbox() {
    setEditingMailboxId(null);
    setEditDisplayName("");
    setEditGroupId("ALL");
    setEditNewGroupName("");
  }

  async function createMailbox() {
    startTransition(async () => {
      const response = await fetch("/api/mailboxes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailAddress,
          displayName,
          provider,
          groupId: selectedGroupId === "ALL" || selectedGroupId === "__new__" ? undefined : selectedGroupId,
          newGroupName: selectedGroupId === "__new__" ? newGroupName : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Kh?ng t?o ???c mailbox.");
        return;
      }

      setEmailAddress("");
      setDisplayName("");
      setNewGroupName("");
      setSelectedGroupId("ALL");
      toast.success("?? t?o mailbox. B?n c? th? m? K?t n?i ? tab m?i ho?c sao ch?p URL consent.");
      router.refresh();
    });
  }

  async function saveMailboxEdits() {
    if (!editingMailbox) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/mailboxes/${editingMailbox.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: editDisplayName,
          groupId: editGroupId === "ALL" || editGroupId === "__new__" ? undefined : editGroupId,
          newGroupName: editGroupId === "__new__" ? editNewGroupName : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Kh?ng c?p nh?t ???c mailbox.");
        return;
      }

      toast.success("?? c?p nh?t th?ng tin mailbox.");
      cancelEditMailbox();
      router.refresh();
    });
  }

  async function deleteMailbox(mailbox: MailboxRow) {
    if (!window.confirm(`X?a mailbox ${mailbox.emailAddress}? To?n b? mail ?? ??ng b? c?a mailbox n?y s? b? x?a.`)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/mailboxes/${mailbox.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Kh?ng x?a ???c mailbox.");
        return;
      }

      if (editingMailboxId === mailbox.id) {
        cancelEditMailbox();
      }
      toast.success("?? x?a mailbox.");
      router.refresh();
    });
  }

  async function syncSelected() {
    if (selectedIds.length === 0) {
      toast.error("H?y ch?n mailbox tr??c khi ??ng b?.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/scan-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mailboxIds: selectedIds,
          syncWindowDays: Number(syncWindowDays),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Kh?ng th? b?t ??u ??ng b?.");
        return;
      }

      toast.success("?? x?p l?ch ??ng b? cho c?c mailbox ?? ch?n.");
      router.push("/scan-jobs");
      router.refresh();
    });
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) {
      toast.error("H?y nh?p t?n nh?m m?i.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/mailbox-groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Kh?ng t?o ???c nh?m mailbox.");
        return;
      }

      setNewGroupName("");
      setSelectedGroupId("ALL");
      toast.success("?? t?o nh?m mailbox.");
      router.refresh();
    });
  }

  async function renameGroup(group: GroupRow) {
    const nextName = window.prompt("T?n nh?m m?i", group.name)?.trim();
    if (!nextName || nextName === group.name) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/mailbox-groups/${group.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: nextName }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Kh?ng c?p nh?t ???c nh?m mailbox.");
        return;
      }

      toast.success("?? c?p nh?t nh?m mailbox.");
      router.refresh();
    });
  }

  async function deleteGroup(group: GroupRow) {
    if (!window.confirm(`X?a nh?m ${group.name}? C?c mailbox trong nh?m s? chuy?n v? All.`)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/mailbox-groups/${group.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Kh?ng x?a ???c nh?m mailbox.");
        return;
      }

      if (selectedGroupId === group.id) {
        setSelectedGroupId("ALL");
      }
      if (groupFilter === group.id) {
        setGroupFilter("ALL");
      }
      if (editGroupId === group.id) {
        setEditGroupId("ALL");
      }
      toast.success("?? x?a nh?m mailbox.");
      router.refresh();
    });
  }

  async function requestConsentUrl(mailboxId: string) {
    const response = await fetch(`/api/mailboxes/${mailboxId}/consent-link`, {
      method: "POST",
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error ?? "Kh?ng t?o ???c URL consent.");
    }

    return payload.url;
  }

  async function openConsentWindow(mailboxId: string) {
    const popup = window.open("", "_blank");
    setBusyMailboxId(mailboxId);
    try {
      const url = await requestConsentUrl(mailboxId);
      if (popup) {
        popup.location.href = url;
      } else {
        window.open(url, "_blank");
      }
      toast.success("?? m? trang c?p quy?n ? tab m?i.");
      router.refresh();
    } catch (error) {
      popup?.close();
      toast.error(error instanceof Error ? error.message : "Kh?ng t?o ???c URL consent.");
    } finally {
      setBusyMailboxId(null);
    }
  }

  async function copyConsentUrl(mailboxId: string) {
    setBusyMailboxId(mailboxId);
    try {
      const url = await requestConsentUrl(mailboxId);
      await navigator.clipboard.writeText(url);
      toast.success("?? sao ch?p URL consent.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kh?ng sao ch?p ???c URL consent.");
    } finally {
      setBusyMailboxId(null);
    }
  }

  const activeGroup = selectedGroupId !== "ALL" && selectedGroupId !== "__new__" ? groups.find((group) => group.id === selectedGroupId) ?? null : null;

  function getProviderLabel(value: string | null) {
    switch (value) {
      case "GMAIL":
        return "Gmail";
      case "OUTLOOK":
        return "Hotmail / Outlook";
      default:
        return "";
    }
  }

  function getSelectedGroupLabel(value: string | null) {
    if (!value || value === "ALL") {
      return "All";
    }
    if (value === "__new__") {
      return "+ T?o nh?m m?i";
    }

    const group = groups.find((item) => item.id === value);
    return group ? `${group.name} (${group.mailboxCount})` : value;
  }

  function getGroupLabel(value: string | null) {
    if (!value || value === "ALL") {
      return "All";
    }
    if (value === "__new__") {
      return "+ T?o nh?m m?i";
    }

    return groups.find((item) => item.id === value)?.name ?? value;
  }

  function getProviderFilterLabel(value: string | null) {
    switch (value) {
      case "GMAIL":
        return "Gmail";
      case "OUTLOOK":
        return "Hotmail / Outlook";
      case "ALL":
      default:
        return "T?t c? nh? cung c?p";
    }
  }

  function getStatusFilterLabel(value: string | null) {
    switch (value) {
      case "ACTIVE":
        return "?ang ho?t ??ng";
      case "PENDING_CONSENT":
        return "Ch? consent";
      case "RECONNECT_REQUIRED":
        return "C?n k?t n?i l?i";
      case "ERROR":
        return "L?i";
      case "DISABLED":
        return "?? t?t";
      case "DRAFT":
        return "Nh?p";
      case "ALL":
      default:
        return "T?t c? tr?ng th?i";
    }
  }

  function getGroupFilterLabel(value: string | null) {
    if (!value || value === "ALL") {
      return "T?t c? nh?m";
    }

    return groups.find((item) => item.id === value)?.name ?? value;
  }

  function getSyncWindowLabel(value: string | null) {
    switch (value) {
      case "1":
        return "1 ng?y";
      case "7":
        return "7 ng?y";
      case "30":
        return "30 ng?y";
      default:
        return "";
    }
  }

  return (
    <div className="space-y-4 xl:space-y-5">
      <Card size="sm" className="rounded-[24px] bg-card/92">
        <CardHeader className="gap-1.5 pb-0">
          <CardTitle className="text-lg text-foreground">Th?m mailbox v? qu?n l? nh?m</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <div className="subpanel-surface rounded-[20px] p-3">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1.08fr_1fr_0.78fr_1.12fr_auto]">
              <Input
                value={emailAddress}
                onChange={(event) => setEmailAddress(event.target.value)}
                placeholder="user@example.com"
                className="h-10 rounded-xl px-3"
              />
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="T?n hi?n th? (kh?ng b?t bu?c)"
                className="h-10 rounded-xl px-3"
              />
              <Select value={provider} onValueChange={(value) => setProvider(value as "GMAIL" | "OUTLOOK")}>
                <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                  <SelectValue>{(value) => getProviderLabel(value as string | null)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GMAIL">Gmail</SelectItem>
                  <SelectItem value="OUTLOOK">Hotmail / Outlook</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                      <SelectValue>{(value) => getSelectedGroupLabel(value as string | null)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} ({group.mailboxCount})
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ T?o nh?m m?i</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {activeGroup ? (
                  <>
                    <Button type="button" variant="ghost" size="icon-sm" className="rounded-xl text-muted-foreground hover:text-foreground" onClick={() => void renameGroup(activeGroup)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="rounded-xl text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)]" onClick={() => void deleteGroup(activeGroup)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
              </div>
              <Button
                className="h-10 rounded-xl px-4 text-sm font-semibold"
                onClick={() => void createMailbox()}
                disabled={isPending || !emailAddress.trim() || (selectedGroupId === "__new__" && !newGroupName.trim())}
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                Th?m mailbox
              </Button>
            </div>
          </div>

          {selectedGroupId === "__new__" ? (
            <div className="subpanel-surface flex flex-col gap-2.5 rounded-[20px] p-3 md:flex-row md:items-center">
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="T?n nh?m m?i"
                className="h-10 rounded-xl px-3"
              />
              <Button type="button" variant="outline" className="h-10 rounded-xl px-4" onClick={() => void createGroup()} disabled={isPending || !newGroupName.trim()}>
                <FolderPlus className="mr-2 h-4 w-4" />
                T?o nh?m ngay
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {editingMailbox ? (
        <Card size="sm" className="rounded-[24px] bg-card/92">
          <CardHeader className="gap-1.5 pb-0">
            <CardTitle className="text-lg text-foreground">Ch?nh s?a mailbox</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <div className="subpanel-surface rounded-[20px] p-3">
              <div className="grid gap-2.5 xl:grid-cols-[1.2fr_1fr_1.1fr_auto]">
                <Input value={editingMailbox.emailAddress} disabled className="h-10 rounded-xl px-3" />
                <Input
                  value={editDisplayName}
                  onChange={(event) => setEditDisplayName(event.target.value)}
                  placeholder="T?n hi?n th?"
                  className="h-10 rounded-xl px-3"
                />
                <Select value={editGroupId} onValueChange={setEditGroupId}>
                  <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                    <SelectValue>{(value) => getGroupLabel(value as string | null)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">+ T?o nh?m m?i</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button type="button" className="h-10 rounded-xl px-4 text-sm font-semibold" onClick={() => void saveMailboxEdits()} disabled={isPending || (editGroupId === "__new__" && !editNewGroupName.trim())}>
                    <Save className="mr-2 h-4 w-4" />
                    L?u
                  </Button>
                  <Button type="button" variant="outline" className="h-10 rounded-xl px-4" onClick={cancelEditMailbox}>
                    <X className="mr-2 h-4 w-4" />
                    H?y
                  </Button>
                </div>
              </div>
            </div>

            {editGroupId === "__new__" ? (
              <Input
                value={editNewGroupName}
                onChange={(event) => setEditNewGroupName(event.target.value)}
                placeholder="T?n nh?m m?i cho mailbox n?y"
                className="h-10 rounded-xl px-3"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm" className="rounded-[24px] bg-card/92">
        <CardHeader className="gap-1.5 pb-0">
          <CardTitle className="text-lg text-foreground">Trung t?m ?i?u khi?n mailbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <div className="grid gap-3 xl:grid-cols-[12.25rem_minmax(0,1fr)_17.5rem]">
            <div className="subpanel-surface rounded-[18px] p-2.5">
              <div className="min-h-[1.1rem] text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-foreground/88">?? ch?n</div>
              <div className="mt-1 flex items-end gap-2 text-foreground">
                <span className="text-[1.8rem] leading-none font-semibold tracking-tight">{selectedIds.length}</span>
                <span className="pb-0.5 text-sm font-medium text-muted-foreground">/ {filteredMailboxes.length}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Button variant="secondary" size="sm" className="h-8 w-full rounded-lg px-2.5 text-[0.76rem]" onClick={selectAllVisible}>
                  Ch?n t?t c?
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-full rounded-lg px-2.5 text-[0.76rem]" onClick={clearSelection}>
                  B? ch?n
                </Button>
              </div>
            </div>

            <div className="subpanel-surface rounded-[20px] p-3">
              <div className="mb-1.5 min-h-[1.1rem] text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-foreground/88">B? l?c</div>
              <div className="grid items-end gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_8.5rem]">
                <div className="min-w-0">
                  <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">T?m ki?m</div>
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="T?m theo email ho?c t?n hi?n th?"
                    className="h-10 w-full rounded-xl px-3"
                  />
                </div>
                <div className="w-full">
                  <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Nh? cung c?p</div>
                  <Select value={providerFilter} onValueChange={(value) => setProviderFilter(value as "ALL" | "GMAIL" | "OUTLOOK")}>
                    <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                      <SelectValue>{(value) => getProviderFilterLabel(value as string | null)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">T?t c? nh? cung c?p</SelectItem>
                      <SelectItem value="GMAIL">Gmail</SelectItem>
                      <SelectItem value="OUTLOOK">Hotmail / Outlook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full">
                  <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tr?ng th?i</div>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | MailboxStatus)}>
                    <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                      <SelectValue>{(value) => getStatusFilterLabel(value as string | null)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">T?t c? tr?ng th?i</SelectItem>
                      <SelectItem value="ACTIVE">?ang ho?t ??ng</SelectItem>
                      <SelectItem value="PENDING_CONSENT">Ch? consent</SelectItem>
                      <SelectItem value="RECONNECT_REQUIRED">C?n k?t n?i l?i</SelectItem>
                      <SelectItem value="ERROR">L?i</SelectItem>
                      <SelectItem value="DISABLED">?? t?t</SelectItem>
                      <SelectItem value="DRAFT">Nh?p</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full">
                  <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Nh?m</div>
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                      <SelectValue>{(value) => getGroupFilterLabel(value as string | null)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">T?t c? nh?m</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="subpanel-surface rounded-[20px] p-3.5">
              <div className="mb-1.5 min-h-[1.1rem] text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-foreground/88">Thao t?c</div>
              <div className="grid items-end gap-2.5 xl:grid-cols-[7rem_8.5rem]">
                <div>
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Kho?ng ng?y</div>
                  <Select value={syncWindowDays} onValueChange={setSyncWindowDays}>
                    <SelectTrigger className="h-10 w-[7rem] rounded-xl px-3 text-sm text-foreground/95">
                      <SelectValue>{(value) => getSyncWindowLabel(value as string | null)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 ng?y</SelectItem>
                      <SelectItem value="7">7 ng?y</SelectItem>
                      <SelectItem value="30">30 ng?y</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-transparent">.</div>
                  <Button className="h-10 w-[8.5rem] rounded-xl px-3.5 text-sm font-semibold" onClick={() => void syncSelected()} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    ??ng b?
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="subpanel-surface rounded-[24px]">
            <ScrollArea className="h-[560px] rounded-[24px]">
              <div className="min-w-[1100px] select-none">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl [&_tr]:border-b [&_th]:bg-background/90">
                    <TableRow>
                      <TableHead className="w-14 text-center">STT</TableHead>
                      <TableHead className="w-16 text-center">Ch?n</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>T?n hi?n th?</TableHead>
                      <TableHead>Nh?m</TableHead>
                      <TableHead>Nh? cung c?p</TableHead>
                      <TableHead>Tr?ng th?i</TableHead>
                      <TableHead className="w-[220px]">Thao t?c</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMailboxes.map((mailbox, index) => {
                      const selected = selectedIds.includes(mailbox.id);
                      const isRowBusy = busyMailboxId === mailbox.id;

                      return (
                        <TableRow
                          key={mailbox.id}
                          data-state={selected ? "selected" : undefined}
                          className={`cursor-default ${selected ? "surface-selected" : ""}`}
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
                          <TableCell>
                            <MailboxStatusBadge value={mailbox.status} />
                          </TableCell>
                          <TableCell>
                            <div
                              className="flex items-center gap-1"
                              data-mailbox-action-menu
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Button
                                type="button"
                                size="sm"
                                className="h-9 rounded-xl"
                                disabled={isRowBusy}
                                onClick={() => void openConsentWindow(mailbox.id)}
                              >
                                {isRowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {mailbox.status === "ACTIVE" ? "K?t n?i l?i" : "K?t n?i"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-xl text-muted-foreground hover:text-foreground"
                                title="Copy URL"
                                aria-label="Copy URL"
                                disabled={isRowBusy}
                                onClick={() => void copyConsentUrl(mailbox.id)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <div className="relative">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="rounded-xl text-muted-foreground hover:text-foreground"
                                  title="Th?m thao t?c"
                                  aria-label="Th?m thao t?c"
                                  onClick={() => setOpenActionMenuId((current) => (current === mailbox.id ? null : mailbox.id))}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                {openActionMenuId === mailbox.id ? (
                                  <div className="panel-surface absolute right-0 top-10 z-30 w-72 max-w-[22rem] rounded-2xl p-2 text-popover-foreground">
                                    <div className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                      Thao t?c
                                    </div>
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-accent/75"
                                      onClick={() => {
                                        beginEditMailbox(mailbox);
                                        setOpenActionMenuId(null);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                      <span>S?a</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-[color:var(--danger-soft)]"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        void deleteMailbox(mailbox);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>X?a</span>
                                    </button>
                                    <div className="my-2 h-px bg-border" />
                                    <div className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                      Th?ng tin
                                    </div>
                                    <div className="space-y-3 px-3 py-2 text-sm">
                                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                                        <span className="min-w-0 whitespace-normal break-words text-muted-foreground">S? mail</span>
                                        <span className="text-right font-medium text-foreground">{mailbox.messageCount}</span>
                                      </div>
                                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                                        <span className="min-w-0 whitespace-normal break-words text-muted-foreground">S? job</span>
                                        <span className="text-right font-medium text-foreground">{mailbox.jobCount}</span>
                                      </div>
                                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)] items-start gap-x-4 gap-y-1">
                                        <span className="min-w-0 whitespace-normal break-words text-muted-foreground">L?n ??ng b? cu?i</span>
                                        <span className="min-w-0 whitespace-normal break-words text-right font-medium leading-6 text-foreground">
                                          {mailbox.lastSyncedAt ? formatDateTime(mailbox.lastSyncedAt) : "Ch?a ??ng b?"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>

          {filteredMailboxes.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Kh?ng c? mailbox n?o kh?p v?i b? l?c hi?n t?i.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
