import Link from "next/link";
import { Download, FileSearch, MailSearch, Paperclip } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DaysInput } from "@/components/shared/days-input";

const SEARCH_MAX_DAYS = 90;
import { MailboxSelectionTable } from "@/components/shared/mailbox-selection-table";
import { buildLocalSearchSummary, parseLookbackDays, parseSearchMode } from "@/lib/mail/query";
import { createSearchParams, paginateArray, parsePageParam } from "@/lib/pagination";
import { searchMailToolResults } from "@/lib/queries/app-data";
import { appendMailboxSelectionParams, parseMailboxSelectionInput, resolveMailboxSelection } from "@/lib/queries/mailbox-filter";
import { formatDateTime, truncate } from "@/lib/utils";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SEARCH_PAGE_SIZE = 5;

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
  const page = parsePageParam(params.page, 1);
  const mailboxSearch = typeof params.mailboxSearch === "string" ? params.mailboxSearch : "";
  const mailboxProvider = params.mailboxProvider === "GMAIL" || params.mailboxProvider === "OUTLOOK" ? params.mailboxProvider : "ALL";
  const mailboxSelection = parseMailboxSelectionInput({
    selectionMode: params.selectionMode,
    mailboxId: params.mailboxId,
    excludeMailboxId: params.excludeMailboxId,
  });

  const selection = await resolveMailboxSelection(admin.id, mailboxSelection);
  const activeMailboxes = selection.mailboxes.filter((mailbox) => mailbox.status === "ACTIVE");
  const activeMailboxIds = new Set(activeMailboxes.map((mailbox) => mailbox.id));
  const activeGroupIds = new Set(activeMailboxes.flatMap((mailbox) => (mailbox.group?.id ? [mailbox.group.id] : [])));
  const mailboxGroup = typeof params.mailboxGroup === "string" && activeGroupIds.has(params.mailboxGroup) ? params.mailboxGroup : "ALL";
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
  appendMailboxSelectionParams(exportParams, mailboxSelection);

  const pagedResults = paginateArray(results, page, SEARCH_PAGE_SIZE);

  function buildPageHref(nextPage: number) {
    const nextParams = createSearchParams(params);
    if (nextPage <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(nextPage));
    }
    const query = nextParams.toString();
    return query ? `/search?${query}` : "/search";
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88 !overflow-visible gap-2">
        <CardHeader className="pb-1">
          <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Tìm kiếm mail / Đơn hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/search" className="grid gap-3">
            <MailboxSelectionTable
              mailboxes={activeMailboxes.map((mailbox) => ({
                ...mailbox,
                lastSyncedAt: mailbox.lastSyncedAt?.toISOString() ?? null,
              }))}
              selectedMailboxIds={selectedMailboxIds}
              initialSearchTerm={mailboxSearch}
              initialProviderFilter={mailboxProvider}
              initialGroupFilter={mailboxGroup}
            />

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                {/* Search Fields Group */}
                <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-1 lg:min-w-[400px]">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Từ khóa</div>
                    <Input name="keyword" defaultValue={keyword} placeholder='Từ khóa theo dạng "otp / amazon"' className="h-10 w-full rounded-xl px-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Người gửi</div>
                    <Input name="sender" defaultValue={sender} placeholder="Người gửi" className="h-10 w-full rounded-xl px-3" />
                  </div>
                </div>

                {/* Selectors Group */}
                <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-1 lg:gap-3">
                  <div className="min-w-0 flex-1 lg:min-w-[180px]">
                    <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Khoảng ngày</div>
                    <DaysInput
                      name="lookbackDays"
                      defaultValue={lookbackDays}
                      min={1}
                      max={SEARCH_MAX_DAYS}
                    />
                  </div>
                  <div className="min-w-0 flex-1 lg:w-[160px]">
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
                </div>

                {/* Buttons Group */}
                <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-1">
                  <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground whitespace-nowrap lg:px-6">
                    <MailSearch className="mr-2 h-4 w-4" />
                    Lọc mailbox
                  </button>
                  <Link
                    href={`/api/search/export?${exportParams.toString()}`}
                    className="btn-action-excel inline-flex h-10 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium whitespace-nowrap transition-all lg:px-6"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Xuất Excel
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
                Phạm vi tìm kiếm: {selectedMailboxIds.length} mailbox, {pagedResults.totalItems} kết quả duy nhất
              </span>
              <span className="text-sm text-muted-foreground">{effectiveSummary || "mode:body | days:30"}</span>
            </CardContent>
          </Card>

          {pagedResults.totalItems > 0 ? (
            pagedResults.items.map((result) => (
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

          <PaginationControls
            currentPage={pagedResults.currentPage}
            totalPages={pagedResults.totalPages}
            totalItems={pagedResults.totalItems}
            pageSize={pagedResults.pageSize}
            itemLabel="kết quả"
            buildPageHref={buildPageHref}
          />
        </div>
      )}
    </div>
  );
}



