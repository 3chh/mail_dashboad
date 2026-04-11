import Link from "next/link";
import { Download, FileSearch, MailSearch, Paperclip } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MailboxSelectionTable } from "@/components/shared/mailbox-selection-table";
import { buildLocalSearchSummary, parseLookbackDays, parseSearchMode } from "@/lib/mail/query";
import { searchMailToolResults } from "@/lib/queries/app-data";
import { parseMultiValueParam, resolveMailboxSelection } from "@/lib/queries/mailbox-filter";
import { formatDateTime, truncate } from "@/lib/utils";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const admin = await getRequiredAdmin();
  const params = await searchParams;

  const keyword = typeof params.keyword === "string" ? params.keyword : "";
  const sender = typeof params.sender === "string" ? params.sender : "";
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : "";
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : "";
  const unreadOnly = params.unreadOnly === "true";
  const withAttachments = params.withAttachments === "true";
  const lookbackDays = parseLookbackDays(typeof params.lookbackDays === "string" ? params.lookbackDays : undefined, 30);
  const mode = parseSearchMode(typeof params.mode === "string" ? params.mode : undefined);

  const selection = await resolveMailboxSelection(admin.id, parseMultiValueParam(params.mailboxId));
  const activeMailboxes = selection.mailboxes.filter((mailbox) => mailbox.status === "ACTIVE");
  const activeMailboxIds = new Set(activeMailboxes.map((mailbox) => mailbox.id));
  const selectedMailboxIds = selection.selectedMailboxIds.filter((mailboxId) => activeMailboxIds.has(mailboxId));

  const results =
    selectedMailboxIds.length > 0
      ? await searchMailToolResults(
        selectedMailboxIds,
        {
          keyword: keyword || undefined,
          sender: sender || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          unreadOnly,
          withAttachments,
          lookbackDays,
          mode,
        },
        admin.id,
      )
      : [];

  const effectiveSummary = buildLocalSearchSummary({
    keyword,
    sender,
    dateFrom,
    dateTo,
    unreadOnly,
    withAttachments,
    lookbackDays,
    mode,
  });

  const exportParams = new URLSearchParams();
  exportParams.set("mode", mode);
  exportParams.set("lookbackDays", String(lookbackDays));
  if (keyword) exportParams.set("keyword", keyword);
  if (sender) exportParams.set("sender", sender);
  if (dateFrom) exportParams.set("dateFrom", dateFrom);
  if (dateTo) exportParams.set("dateTo", dateTo);
  if (unreadOnly) exportParams.set("unreadOnly", "true");
  if (withAttachments) exportParams.set("withAttachments", "true");
  for (const mailboxId of selectedMailboxIds) {
    exportParams.append("mailboxId", mailboxId);
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88 !overflow-visible">
        <CardHeader>
          <CardTitle>Tìm kiếm mail / Đơn hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3">
            <MailboxSelectionTable
              mailboxes={activeMailboxes.map((mailbox) => ({
                ...mailbox,
                lastSyncedAt: mailbox.lastSyncedAt?.toISOString() ?? null,
              }))}
              selectedMailboxIds={selectedMailboxIds}
            />

            <div className="grid gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160px] flex-1">
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Từ khóa</div>
                  <Input name="keyword" defaultValue={keyword} placeholder='Từ khóa theo dạng "otp / amazon"' className="h-10 rounded-xl" />
                </div>
                <div className="min-w-[140px] flex-1">
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Người gửi</div>
                  <Input name="sender" defaultValue={sender} placeholder="Người gửi" className="h-10 rounded-xl" />
                </div>
                <div className="min-w-[120px] flex-[0_1_150px]">
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Khoảng ngày</div>
                  <Select name="lookbackDays" defaultValue={String(lookbackDays)}>
                    <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 ngày</SelectItem>
                      <SelectItem value="7">7 ngày</SelectItem>
                      <SelectItem value="30">30 ngày</SelectItem>
                      <SelectItem value="90">90 ngày</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[150px] flex-[0_1_190px]">
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Phạm vi</div>
                  <Select name="mode" defaultValue={mode}>
                    <SelectTrigger className="h-10 w-full rounded-xl px-3 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="body">Chỉ tìm trong body</SelectItem>
                      <SelectItem value="order">Chỉ tìm trong đơn hàng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="submit" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground whitespace-nowrap">
                    <MailSearch className="mr-2 h-4 w-4" />
                    Lọc mailbox
                  </button>
                  <Link
                    href={`/api/search/export?${exportParams.toString()}`}
                    className="control-surface inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-foreground whitespace-nowrap"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Xuất CSV
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="unreadOnly" value="true" defaultChecked={unreadOnly} />
                  Chỉ mail chưa đọc
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="withAttachments" value="true" defaultChecked={withAttachments} />
                  Có tệp đính kèm
                </label>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {selectedMailboxIds.length === 0 ? (
        <Card className="rounded-[28px] bg-card/88">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <FileSearch className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Chưa chọn mailbox</h2>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              Hãy chọn mailbox trên bảng ở đầu trang để bắt đầu tìm kiếm.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card className="rounded-[20px] bg-card/88">
            <CardContent className="flex flex-col gap-2 p-4 xl:flex-row xl:items-center xl:justify-between">
              <span className="mr-4 text-sm font-medium text-muted-foreground">
                Phạm vi tìm kiếm: {selectedMailboxIds.length} mailbox, {results.length} kết quả duy nhất
              </span>
              <span className="text-sm text-muted-foreground">{effectiveSummary || "mode:body | days:30"}</span>
            </CardContent>
          </Card>

          {results.length > 0 ? (
            results.map((result) => (
              <Card key={result.id} className="rounded-[28px] bg-card/88">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                          {result.to}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {result.name}
                        </Badge>
                        {result.hasAttachments ? (
                          <Badge variant="outline" className="rounded-full">
                            <Paperclip className="mr-1 h-3 w-3" />
                            Tệp đính kèm
                          </Badge>
                        ) : null}
                        {mode === "order" ? <Badge className="semantic-warning rounded-full border hover:brightness-105">Mode đơn hàng</Badge> : null}
                      </div>
                      <p className="mt-3 text-lg font-semibold">{result.subject || "Không có tiêu đề"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{result.from}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">{formatDateTime(result.receivedAt)}</div>
                  </div>

                  {mode === "order" ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tracking</p>
                        <p className="mt-2 text-sm font-medium">{result.tracking}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Warehouse</p>
                        <p className="mt-2 text-sm font-medium">{result.warehouse}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Address</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{truncate(result.address, 160) || "N/A"}</p>
                      </div>
                    </div>
                  ) : null}

                  <p className="text-sm leading-7 text-muted-foreground">{truncate(result.snippet || result.body, mode === "order" ? 220 : 320)}</p>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/messages/${result.messageId}`} className="control-surface rounded-xl px-3 py-2 text-sm font-medium text-foreground">
                      Mở email
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="rounded-[28px] bg-card/88">
              <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
                <FileSearch className="h-10 w-10 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Không có kết quả phù hợp</h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Hãy đồng bộ mailbox trước, tăng số ngày quét, hoặc đổi bộ lọc tìm kiếm.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}



