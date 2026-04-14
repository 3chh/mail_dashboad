import { MailOpen, ShieldCheck, Wifi } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { CopyOtpButton } from "@/components/otp/copy-otp-button";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { MailboxSelectionTable } from "@/components/shared/mailbox-selection-table";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSearchParams, paginateArray, parsePageParam } from "@/lib/pagination";
import { getOtpMonitorData } from "@/lib/queries/app-data";
import { parseMailboxSelectionInput, resolveMailboxSelection } from "@/lib/queries/mailbox-filter";
import { formatDateTime, truncate } from "@/lib/utils";

type OtpPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const OTP_PAGE_SIZE = 5;

export default async function OtpPage({ searchParams }: OtpPageProps) {
  const admin = await getRequiredAdmin();
  const params = await searchParams;
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
  const pagedMailboxIds = paginateArray(selectedMailboxIds, page, OTP_PAGE_SIZE);

  const results = pagedMailboxIds.totalItems > 0 ? await getOtpMonitorData(pagedMailboxIds.items) : [];

  function buildPageHref(nextPage: number) {
    const nextParams = createSearchParams(params);
    if (nextPage <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(nextPage));
    }
    const query = nextParams.toString();
    return query ? `/otp?${query}` : "/otp";
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88 !overflow-visible gap-2">
        <CardHeader className="pb-1">
          <CardTitle className="font-sans !text-2xl font-semibold tracking-tight text-foreground">Lấy OTP từ mail</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/otp" className="grid gap-3">
            <MailboxSelectionTable
              mailboxes={activeMailboxes.map((mailbox) => ({
                ...mailbox,
                lastSyncedAt: mailbox.lastSyncedAt?.toISOString() ?? null,
              }))}
              selectedMailboxIds={selectedMailboxIds}
              initialSearchTerm={mailboxSearch}
              initialProviderFilter={mailboxProvider}
              initialGroupFilter={mailboxGroup}
              action={(
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_18px_38px_-24px_rgba(44,143,153,0.42)] transition hover:brightness-105"
                >
                  <Wifi className="mr-2 h-4 w-4" />
                  Lấy OTP
                </button>
              )}
            />
          </form>
        </CardContent>
      </Card>

      {selectedMailboxIds.length === 0 ? (
        <Card className="rounded-[28px] bg-card/88">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <MailOpen className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Chưa chọn mailbox</h2>
            <p className="max-w-lg text-sm leading-7 text-muted-foreground">
              Hãy chọn ít nhất 1 mailbox trên dashboard hoặc trong bộ lọc của trang này.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((result) => {
            const labels = result.message?.labels ?? [];
            const candidate = result.latestCandidate;

            return (
              <Card key={result.id} className="rounded-[28px] bg-card/88">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline">{result.mailbox?.emailAddress ?? "Mailbox không xác định"}</Badge>
                        {candidate ? <ConfidenceBadge value={candidate.confidenceLabel} /> : null}
                        {result.errorMessage ? <Badge variant="destructive">Lỗi fetch live mail</Badge> : null}
                        {labels.includes("UNREAD") ? <Badge variant="outline">Chưa đọc</Badge> : null}
                        {!result.message && !result.errorMessage ? <Badge variant="outline">Mailbox chưa có mail</Badge> : null}
                        {result.message && !candidate ? <Badge variant="outline">Mail mới nhất không có OTP</Badge> : null}
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{result.message?.subject ?? "Chưa lấy được mail mới nhất"}</p>
                        <p className="text-sm text-muted-foreground">{result.message?.fromHeader || result.mailbox?.displayName || "Không rõ người gửi"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {candidate ? (
                        <span className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 font-mono text-sm font-semibold text-foreground">
                          {candidate.code}
                        </span>
                      ) : null}
                      {candidate ? <CopyOtpButton code={candidate.code} /> : null}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-sm leading-7 text-muted-foreground">
                        {result.errorMessage
                          ? result.errorMessage
                          : candidate
                            ? truncate(candidate.contextSnippet, 260)
                            : result.message
                              ? "Đã fetch mail mới nhất, nhưng không tìm thấy OTP hợp lệ trong mail này."
                              : "Mailbox này chưa có mail nào để đọc trực tiếp từ provider."}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>{formatDateTime(result.message?.receivedAt)}</div>
                      {candidate ? (
                        <div className="mt-2 flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" />
                          {Math.round(candidate.confidenceScore * 100)}% độ tin cậy
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <PaginationControls
            currentPage={pagedMailboxIds.currentPage}
            totalPages={pagedMailboxIds.totalPages}
            totalItems={pagedMailboxIds.totalItems}
            pageSize={pagedMailboxIds.pageSize}
            itemLabel="mailbox"
            buildPageHref={buildPageHref}
          />
        </div>
      )}
    </div>
  );
}
