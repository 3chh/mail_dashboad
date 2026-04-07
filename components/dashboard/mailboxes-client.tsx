"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailPlus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { MailboxStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  status: MailboxStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  messageCount: number;
  jobCount: number;
};

type DragMode = "select" | "deselect";

function buildSelectionQuery(selectedIds: string[]) {
  const params = new URLSearchParams();
  for (const id of selectedIds) {
    params.append("mailboxId", id);
  }
  return params.toString();
}

function normalizeMailboxSearch(value: string) {
  return value.trim().toLowerCase();
}

export function MailboxesClient({ mailboxes }: { mailboxes: MailboxRow[] }) {
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | MailboxStatus>("ALL");

  useEffect(() => {
    function handleMouseUp() {
      setDragMode(null);
    }

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const normalizedSearch = normalizeMailboxSearch(searchTerm);
  const filteredMailboxes = mailboxes.filter((mailbox) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      mailbox.emailAddress.toLowerCase().includes(normalizedSearch) ||
      (mailbox.displayName ?? "").toLowerCase().includes(normalizedSearch);
    const matchesProvider = providerFilter === "ALL" || mailbox.provider === providerFilter;
    const matchesStatus = statusFilter === "ALL" || mailbox.status === statusFilter;

    return matchesSearch && matchesProvider && matchesStatus;
  });

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

  function openSelected(pathname: string) {
    if (selectedIds.length === 0) {
      toast.error("Hãy chọn ít nhất 1 mailbox.");
      return;
    }

    const query = buildSelectionQuery(selectedIds);
    router.push(`${pathname}?${query}`);
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
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? "Không tạo được mailbox.");
        return;
      }

      setEmailAddress("");
      setDisplayName("");
      toast.success("Đã tạo mailbox. Tiếp theo hãy bấm Kết nối.");
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

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? "Không thể bắt đầu đồng bộ.");
        return;
      }

      toast.success("Đã xếp lịch đồng bộ cho các mailbox đã chọn.");
      router.push("/scan-jobs");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] border-border/70 bg-white/75">
        <CardHeader>
          <CardTitle>Thêm mailbox để onboarding</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.7fr_auto]">
          <Input
            value={emailAddress}
            onChange={(event) => setEmailAddress(event.target.value)}
            placeholder="user@example.com"
            className="h-11 rounded-2xl"
          />
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Tên hiển thị (không bắt buộc)"
            className="h-11 rounded-2xl"
          />
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as "GMAIL" | "OUTLOOK")}
            className="h-11 rounded-2xl border border-input bg-background px-3 text-sm"
          >
            <option value="GMAIL">Gmail</option>
            <option value="OUTLOOK">Hotmail / Outlook</option>
          </select>
          <Button
            className="h-11 rounded-2xl"
            onClick={() => void createMailbox()}
            disabled={isPending || !emailAddress}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
            Thêm mailbox
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-border/70 bg-white/75">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle>Trung tâm điều khiển mailbox</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Bảng cuộn để quản lý mailbox như spreadsheet: tìm theo tên, lọc theo trạng thái và nhà cung cấp, rồi kéo thả chuột để chọn nhiều dòng.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="rounded-2xl" onClick={selectAllVisible}>
                Chọn tất cả đang hiển thị
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={clearSelection}>
                Bỏ chọn
              </Button>
              <select
                value={syncWindowDays}
                onChange={(event) => setSyncWindowDays(event.target.value)}
                className="h-10 rounded-2xl border border-input bg-background px-3 text-sm"
              >
                <option value="1">1 ngày</option>
                <option value="7">7 ngày</option>
                <option value="30">30 ngày</option>
              </select>
              <Button className="rounded-2xl" onClick={() => void syncSelected()} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Đồng bộ đã chọn
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => openSelected("/search")}>
                <Search className="mr-2 h-4 w-4" />
                Tìm kiếm
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => openSelected("/otp")}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Lấy OTP
              </Button>
            </div>
          </div>

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
        </CardHeader>
        <CardContent>
          <div className="rounded-[24px] border border-border/70 bg-background/70">
            <ScrollArea className="h-[560px] rounded-[24px]">
              <div className="min-w-[1120px] select-none">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur [&_tr]:border-b [&_th]:bg-background/95">
                    <TableRow>
                      <TableHead className="w-14 text-center">STT</TableHead>
                      <TableHead className="w-16 text-center">Chọn</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tên hiển thị</TableHead>
                      <TableHead>Nhà cung cấp</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Số mail</TableHead>
                      <TableHead>Số job</TableHead>
                      <TableHead>Lần đồng bộ cuối</TableHead>
                      <TableHead>Lỗi gần nhất</TableHead>
                      <TableHead className="w-32">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMailboxes.map((mailbox, index) => {
                      const selected = selectedIds.includes(mailbox.id);
                      const connectHref =
                        mailbox.provider === "GMAIL"
                          ? `/api/oauth/google/start?mailboxId=${mailbox.id}`
                          : `/api/oauth/outlook/start?mailboxId=${mailbox.id}`;

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
                            <input
                              type="checkbox"
                              checked={selected}
                              readOnly
                              className="pointer-events-none"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{mailbox.emailAddress}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{mailbox.displayName || "-"}</TableCell>
                          <TableCell>
                            <ProviderBadge provider={mailbox.provider} />
                          </TableCell>
                          <TableCell>
                            <MailboxStatusBadge value={mailbox.status} />
                          </TableCell>
                          <TableCell>{mailbox.messageCount}</TableCell>
                          <TableCell>{mailbox.jobCount}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(mailbox.lastSyncedAt)}</TableCell>
                          <TableCell>
                            <div className="max-w-[240px] truncate text-sm text-rose-700">{mailbox.lastError || "-"}</div>
                          </TableCell>
                          <TableCell>
                            <a
                              href={connectHref}
                              onMouseDown={(event) => event.stopPropagation()}
                              className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-sm font-medium"
                            >
                              {mailbox.status === "ACTIVE" ? "Kết nối lại" : "Kết nối"}
                            </a>
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
    </div>
  );
}
