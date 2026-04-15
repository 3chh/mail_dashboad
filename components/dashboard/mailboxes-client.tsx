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
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { MailboxStatusBadge } from "@/components/shared/mailbox-status-badge";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const [mailboxToDelete, setMailboxToDelete] = useState<MailboxRow | null>(null);
  const [groupToRename, setGroupToRename] = useState<GroupRow | null>(null);
  const [groupRenameValue, setGroupRenameValue] = useState("");
  const [groupToDelete, setGroupToDelete] = useState<GroupRow | null>(null);
  const [mailboxToReconnect, setMailboxToReconnect] = useState<Pick<MailboxRow, "id" | "status" | "emailAddress"> | null>(null);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    function handleMouseUp() {
      setDragMode(null);
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
    window.addEventListener("storage", handleConsentStorage);
    window.addEventListener("message", handleConsentMessage);
    window.addEventListener("focus", handleConsentComplete);

    return () => {
      channel?.removeEventListener("message", handleConsentComplete);
      channel?.close();
      window.removeEventListener("mouseup", handleMouseUp);
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
        toast.error(payload?.error ?? "Không tạo được mailbox.");
        return;
      }

      setEmailAddress("");
      setDisplayName("");
      setNewGroupName("");
      setSelectedGroupId("ALL");
      toast.success("Đã tạo mailbox. Bạn có thể mở Kết nối ở tab mới hoặc sao chép URL consent.");
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
        toast.error(payload?.error ?? "Không cập nhật được mailbox.");
        return;
      }

      toast.success("Đã cập nhật thông tin mailbox.");
      cancelEditMailbox();
      router.refresh();
    });
  }

  async function deleteMailbox(mailbox: MailboxRow) {
    startTransition(async () => {
      const response = await fetch(`/api/mailboxes/${mailbox.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Không xóa được mailbox.");
        return;
      }

      if (editingMailboxId === mailbox.id) {
        cancelEditMailbox();
      }
      setMailboxToDelete(null);
      toast.success("Đã xóa mailbox.");
      router.refresh();
    });
  }

  async function syncSelected() {
    if (selectedIds.length === 0) {
      toast.error("Hãy chọn mailbox trước khi đồng bộ.");
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
        toast.error(payload?.error ?? "Không thể bắt đầu đồng bộ.");
        return;
      }

      toast.success("Đã xếp lịch đồng bộ cho các mailbox đã chọn.");
      router.push("/scan-jobs");
      router.refresh();
    });
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) {
      toast.error("Hãy nhập tên nhóm mới.");
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
        toast.error(payload?.error ?? "Không tạo được nhóm mailbox.");
        return;
      }

      setNewGroupName("");
      setSelectedGroupId("ALL");
      toast.success("Đã tạo nhóm mailbox.");
      router.refresh();
    });
  }

  function openRenameGroupDialog(group: GroupRow) {
    setGroupToRename(group);
    setGroupRenameValue(group.name);
  }

  function closeRenameGroupDialog() {
    setGroupToRename(null);
    setGroupRenameValue("");
  }

  async function renameGroup(group: GroupRow) {
    const nextName = groupRenameValue.trim();
    if (!nextName || nextName === group.name) {
      closeRenameGroupDialog();
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
        toast.error(payload?.error ?? "Không cập nhật được nhóm mailbox.");
        return;
      }

      closeRenameGroupDialog();
      toast.success("Đã cập nhật nhóm mailbox.");
      router.refresh();
    });
  }

  async function deleteGroup(group: GroupRow) {
    startTransition(async () => {
      const response = await fetch(`/api/mailbox-groups/${group.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Không xóa được nhóm mailbox.");
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
      setGroupToDelete(null);
      toast.success("Đã xóa nhóm mailbox.");
      router.refresh();
    });
  }

  async function requestConsentUrl(mailboxId: string) {
    const response = await fetch(`/api/mailboxes/${mailboxId}/consent-link`, {
      method: "POST",
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error ?? "Không tạo được URL consent.");
    }

    return payload.url;
  }

  async function openConsentWindow(mailbox: Pick<MailboxRow, "id" | "status" | "emailAddress">, skipConfirm = false) {
    if (mailbox.status === "ACTIVE" && !skipConfirm) {
      setMailboxToReconnect(mailbox);
      return;
    }

    setMailboxToReconnect(null);
    const popup = window.open("", "_blank");
    setBusyMailboxId(mailbox.id);
    try {
      const url = await requestConsentUrl(mailbox.id);
      if (popup) {
        popup.location.href = url;
      } else {
        window.open(url, "_blank");
      }
      toast.success("Đã mở trang cấp quyền ở tab mới.");
      router.refresh();
    } catch (error) {
      popup?.close();
      toast.error(error instanceof Error ? error.message : "Không tạo được URL consent.");
    } finally {
      setBusyMailboxId(null);
    }
  }

  async function copyConsentUrl(mailboxId: string) {
    setBusyMailboxId(mailboxId);
    try {
      const url = await requestConsentUrl(mailboxId);
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép URL consent.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không sao chép được URL consent.");
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
      return "+ Tạo nhóm mới";
    }

    const group = groups.find((item) => item.id === value);
    return group ? `${group.name} (${group.mailboxCount})` : value;
  }

  function getGroupLabel(value: string | null) {
    if (!value || value === "ALL") {
      return "All";
    }
    if (value === "__new__") {
      return "+ Tạo nhóm mới";
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
        return "Tất cả";
    }
  }

  function getStatusFilterLabel(value: string | null) {
    switch (value) {
      case "ACTIVE":
        return "Đang hoạt động";
      case "PENDING_CONSENT":
        return "Chờ cấp quyền";
      case "RECONNECT_REQUIRED":
        return "Cần kết nối lại";
      case "ERROR":
        return "Lỗi";
      case "DISABLED":
        return "Đã tắt";
      case "DRAFT":
        return "Nháp";
      case "ALL":
      default:
        return "Tất cả";
    }
  }

  function getGroupFilterLabel(value: string | null) {
    if (!value || value === "ALL") {
      return "All";
    }

    return groups.find((item) => item.id === value)?.name ?? value;
  }

  function getSyncWindowLabel(value: string | null) {
    switch (value) {
      case "1":
        return "1 ngày";
      case "7":
        return "7 ngày";
      case "30":
        return "30 ngày";
      default:
        return "";
    }
  }

  return (
    <div className="space-y-4 xl:space-y-5">
      <Card size="sm" className="rounded-[24px] bg-card/92 gap-1.5">
        <CardHeader className="gap-1.5 pb-0">
          <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Thêm mailbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-1.5">
          <div className="subpanel-surface rounded-[20px] p-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
              <Input
                value={emailAddress}
                onChange={(event) => setEmailAddress(event.target.value)}
                placeholder="user@example.com"
                className="h-10 flex-1 rounded-xl px-3 lg:min-w-[180px]"
              />
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Tên hiển thị (không bắt buộc)"
                className="h-10 flex-1 rounded-xl px-3 lg:min-w-[160px]"
              />
              <div className="grid w-full grid-cols-2 gap-2.5 lg:w-auto lg:flex lg:flex-1 lg:gap-2.5">
                <Select value={provider} onValueChange={(value) => value && setProvider(value as "GMAIL" | "OUTLOOK")}>
                  <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95 lg:flex-1">
                    <SelectValue>{(value) => getProviderLabel(value as string | null)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GMAIL">Gmail</SelectItem>
                    <SelectItem value="OUTLOOK">Hotmail / Outlook</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 lg:flex-1">
                  <div className="flex-1">
                    <Select value={selectedGroupId} onValueChange={(value) => setSelectedGroupId(value ?? "ALL")}>
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
                        <SelectItem value="__new__">+ Tạo nhóm mới</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {activeGroup ? (
                    <div className="flex shrink-0 gap-1.5">
                      <Button type="button" variant="ghost" size="icon-sm" className="rounded-xl text-muted-foreground hover:text-foreground" onClick={() => openRenameGroupDialog(activeGroup)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" className="rounded-xl text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)]" onClick={() => setGroupToDelete(activeGroup)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
              <Button
                className="h-10 w-full rounded-xl px-4 text-sm font-semibold lg:w-auto lg:px-6"
                onClick={() => void createMailbox()}
                disabled={isPending || !emailAddress.trim() || (selectedGroupId === "__new__" && !newGroupName.trim())}
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                Thêm mailbox
              </Button>
            </div>
          </div>

          {selectedGroupId === "__new__" ? (
            <div className="subpanel-surface flex flex-col gap-2.5 rounded-[20px] p-3 md:flex-row md:items-center">
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Tên nhóm mới"
                className="h-10 rounded-xl px-3"
              />
              <Button type="button" variant="outline" className="h-10 rounded-xl px-4" onClick={() => void createGroup()} disabled={isPending || !newGroupName.trim()}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Tạo nhóm ngay
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {editingMailbox ? (
        <Card size="sm" className="rounded-[24px] bg-card/92 gap-1.5">
          <CardHeader className="gap-1.5 pb-0">
            <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Chỉnh sửa mailbox</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-1.5">
            <div className="subpanel-surface rounded-[20px] p-3">
              <div className="grid gap-2.5 xl:grid-cols-[1.2fr_1fr_1.1fr_auto]">
                <Input value={editingMailbox.emailAddress} disabled className="h-10 rounded-xl px-3" />
                <Input
                  value={editDisplayName}
                  onChange={(event) => setEditDisplayName(event.target.value)}
                  placeholder="Tên hiển thị"
                  className="h-10 rounded-xl px-3"
                />
                <Select value={editGroupId} onValueChange={(value) => setEditGroupId(value ?? "ALL")}>
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
                    <SelectItem value="__new__">+ Tạo nhóm mới</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button type="button" className="h-10 rounded-xl px-4 text-sm font-semibold" onClick={() => void saveMailboxEdits()} disabled={isPending || (editGroupId === "__new__" && !editNewGroupName.trim())}>
                    <Save className="mr-2 h-4 w-4" />
                    Lưu
                  </Button>
                  <Button type="button" variant="outline" className="h-10 rounded-xl px-4" onClick={cancelEditMailbox}>
                    <X className="mr-2 h-4 w-4" />
                    Hủy
                  </Button>
                </div>
              </div>
            </div>

            {editGroupId === "__new__" ? (
              <Input
                value={editNewGroupName}
                onChange={(event) => setEditNewGroupName(event.target.value)}
                placeholder="Tên nhóm mới cho mailbox này"
                className="h-10 rounded-xl px-3"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm" className="rounded-[24px] bg-card/92 gap-1.5">
        <CardHeader className="gap-1.5 pb-0">
          <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Trung tâm điều khiển mailbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-1.5">
          <div className="grid gap-3 xl:grid-cols-[12.25rem_minmax(0,1fr)_17.5rem]">
            <div className="subpanel-surface rounded-[18px] p-2.5">
              <div className="min-h-[1.1rem] text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-foreground/88">Đã chọn</div>
              <div className="mt-1 flex items-end gap-2 text-foreground">
                <span className="text-[1.8rem] leading-none font-semibold tracking-tight">{selectedIds.length}</span>
                <span className="pb-0.5 text-sm font-medium text-muted-foreground">/ {filteredMailboxes.length}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Button variant="secondary" size="sm" className="h-8 w-full rounded-lg px-2.5 text-[0.76rem]" onClick={selectAllVisible}>
                  Chọn tất cả
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-full rounded-lg px-2.5 text-[0.76rem]" onClick={clearSelection}>
                  Bỏ chọn
                </Button>
              </div>
            </div>

            <div className="subpanel-surface rounded-[20px] p-3">
              <div className="mb-1.5 min-h-[1.1rem] text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-foreground/88">Bộ lọc</div>
              <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
                <div className="w-full flex-1 lg:min-w-[200px]">
                  <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tìm kiếm</div>
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tìm theo email hoặc tên hiển thị"
                    className="h-10 w-full rounded-xl px-3"
                  />
                </div>
                <div className="grid w-full grid-cols-2 gap-2 lg:w-auto lg:flex lg:flex-1 lg:gap-2">
                  <div className="lg:min-w-[130px] lg:flex-1">
                    <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Nhà cung cấp</div>
                    <Select value={providerFilter} onValueChange={(value) => setProviderFilter((value ?? "ALL") as "ALL" | "GMAIL" | "OUTLOOK")}>
                      <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                        <SelectValue>{(value) => getProviderFilterLabel(value as string | null)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tất cả</SelectItem>
                        <SelectItem value="GMAIL">Gmail</SelectItem>
                        <SelectItem value="OUTLOOK">Hotmail / Outlook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:min-w-[130px] lg:flex-1">
                    <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Trạng thái</div>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter((value ?? "ALL") as "ALL" | MailboxStatus)}>
                      <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                        <SelectValue>{(value) => getStatusFilterLabel(value as string | null)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tất cả</SelectItem>
                        <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
                        <SelectItem value="PENDING_CONSENT">Chờ consent</SelectItem>
                        <SelectItem value="RECONNECT_REQUIRED">Cần kết nối lại</SelectItem>
                        <SelectItem value="ERROR">Lỗi</SelectItem>
                        <SelectItem value="DISABLED">Đã tắt</SelectItem>
                        <SelectItem value="DRAFT">Nháp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="w-full lg:w-[140px] lg:flex-initial">
                  <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Nhóm</div>
                  <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value ?? "ALL")}>
                    <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                      <SelectValue>{(value) => getGroupFilterLabel(value as string | null)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
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
              <div className="mb-1.5 min-h-[1.1rem] text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-foreground/88">Thao tác</div>
              <div className="grid grid-cols-2 items-end gap-2.5 lg:flex lg:flex-row">
                <div className="w-full lg:flex-1 lg:min-w-[120px]">
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Khoảng ngày</div>
                  <Select value={syncWindowDays} onValueChange={(value) => setSyncWindowDays(value ?? "7")}>
                    <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm text-foreground/95">
                      <SelectValue>{(value) => getSyncWindowLabel(value as string | null)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 ngày</SelectItem>
                      <SelectItem value="7">7 ngày</SelectItem>
                      <SelectItem value="30">30 ngày</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full lg:flex-1">
                  <div className="mb-1.5 hidden text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:block lg:text-transparent">.</div>
                  <Button className="h-10 w-full rounded-xl px-3.5 text-sm font-semibold" onClick={() => void syncSelected()} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Đồng bộ
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="subpanel-surface overflow-hidden rounded-[24px]">
            <ScrollArea className="h-[560px]">
              <div className="min-w-[1100px] select-none">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl [&_th]:border-b [&_th]:bg-background/90">
                    <TableRow>
                      <TableHead className="w-14 text-center">STT</TableHead>
                      <TableHead className="w-16 text-center">Chọn</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Tên hiển thị</TableHead>
                      <TableHead>Nhóm</TableHead>
                      <TableHead>Nhà cung cấp</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="w-[220px]">Thao tác</TableHead>
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
                          <TableCell className="text-center text-muted-foreground">{mailbox.displayName || "-"}</TableCell>
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
                                onClick={() => void openConsentWindow(mailbox)}
                              >
                                {isRowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {mailbox.status === "ACTIVE" ? "Kết nối lại" : "Kết nối"}
                              </Button>
                              {mailbox.status !== "ACTIVE" ? (
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
                              ) : null}
                              <DropdownMenu
                                open={openActionMenuId === mailbox.id}
                                onOpenChange={(open) => setOpenActionMenuId(open ? mailbox.id : null)}
                              >
                                <DropdownMenuTrigger
                                  type="button"
                                  className="group/button inline-flex size-7 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-all outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                                  title="Thêm thao tác"
                                  aria-label="Thêm thao tác"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={6} className="w-72 max-w-[22rem] rounded-2xl p-2 text-popover-foreground">
                                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Thao tác
                                  </div>
                                  <DropdownMenuItem
                                    className="rounded-xl px-3 py-2"
                                    onClick={() => {
                                      beginEditMailbox(mailbox);
                                      setOpenActionMenuId(null);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    <span>Sửa</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    className="rounded-xl px-3 py-2"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setMailboxToDelete(mailbox);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Xóa</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Thông tin
                                  </div>
                                  <div className="space-y-3 px-3 py-2 text-sm">
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                                      <span className="min-w-0 whitespace-normal break-words text-muted-foreground">Số mail</span>
                                      <span className="text-right font-medium text-foreground">{mailbox.messageCount}</span>
                                    </div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                                      <span className="min-w-0 whitespace-normal break-words text-muted-foreground">Số job</span>
                                      <span className="text-right font-medium text-foreground">{mailbox.jobCount}</span>
                                    </div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)] items-start gap-x-4 gap-y-1">
                                      <span className="min-w-0 whitespace-normal break-words text-muted-foreground">Last sync</span>
                                      <span className="min-w-0 whitespace-normal break-words text-right font-medium leading-6 text-foreground">
                                        {mailbox.lastSyncedAt ? formatDateTime(mailbox.lastSyncedAt) : "Chưa đồng bộ"}
                                      </span>
                                    </div>
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
              Không có mailbox nào khớp với bộ lọc hiện tại.
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(groupToRename)}
        onOpenChange={(open) => {
          if (!open) {
            closeRenameGroupDialog();
          }
        }}
      >
        <DialogContent className="panel-surface rounded-[28px] border-border/40 bg-card/95 pb-6 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl">Đổi tên nhóm</DialogTitle>
          </DialogHeader>
          <Input
            value={groupRenameValue}
            onChange={(event) => setGroupRenameValue(event.target.value)}
            placeholder="Tên nhóm mới"
            className="h-11 rounded-2xl"
          />
          <div className="mt-2 flex justify-end gap-3">
            <DialogClose
              render={<Button variant="ghost" className="h-10 rounded-xl px-5 font-semibold transition-all hover:bg-muted" disabled={isPending} />}
            >
              Hủy
            </DialogClose>
            <Button
              className="h-10 rounded-xl px-5 font-semibold shadow-sm transition-all hover:brightness-110 active:scale-95"
              disabled={isPending || !groupToRename || !groupRenameValue.trim() || groupRenameValue.trim() === groupToRename.name}
              onClick={() => {
                if (groupToRename) {
                  void renameGroup(groupToRename);
                }
              }}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Lưu tên nhóm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={Boolean(mailboxToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setMailboxToDelete(null);
          }
        }}
        title="Xóa mailbox"
        description={`Xóa mailbox "${mailboxToDelete?.emailAddress ?? ""}"? Toàn bộ mail đã đồng bộ của mailbox này sẽ bị xóa.`}
        confirmLabel="Xóa mailbox"
        confirmVariant="destructive"
        isPending={isPending}
        onConfirm={() => {
          if (mailboxToDelete) {
            void deleteMailbox(mailboxToDelete);
          }
        }}
      />
      <ConfirmActionDialog
        open={Boolean(groupToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setGroupToDelete(null);
          }
        }}
        title="Xóa nhóm mailbox"
        description={`Xóa nhóm "${groupToDelete?.name ?? ""}"? Các mailbox trong nhóm sẽ chuyển về All.`}
        confirmLabel="Xóa nhóm"
        confirmVariant="destructive"
        isPending={isPending}
        onConfirm={() => {
          if (groupToDelete) {
            void deleteGroup(groupToDelete);
          }
        }}
      />
      <ConfirmActionDialog
        open={Boolean(mailboxToReconnect)}
        onOpenChange={(open) => {
          if (!open) {
            setMailboxToReconnect(null);
          }
        }}
        title="Kết nối lại mailbox"
        description={`Mailbox "${mailboxToReconnect?.emailAddress ?? ""}" đang hoạt động. Bạn có chắc muốn kết nối lại không?`}
        confirmLabel="Kết nối lại"
        isPending={Boolean(mailboxToReconnect && busyMailboxId === mailboxToReconnect.id)}
        onConfirm={() => {
          if (mailboxToReconnect) {
            void openConsentWindow(mailboxToReconnect, true);
          }
        }}
      />
    </div>
  );
}
