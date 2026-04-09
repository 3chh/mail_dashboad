import Link from "next/link";
import { Filter, MailOpen, ShieldCheck } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { CopyOtpButton } from "@/components/otp/copy-otp-button";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { MailboxSelectionTable } from "@/components/shared/mailbox-selection-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseLookbackDays } from "@/lib/mail/query";
import { getOtpMonitorData } from "@/lib/queries/app-data";
import { parseMultiValueParam, resolveMailboxSelection } from "@/lib/queries/mailbox-filter";
import { formatDateTime, parseLabelList, truncate } from "@/lib/utils";

type OtpPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OtpPage({ searchParams }: OtpPageProps) {
  const admin = await getRequiredAdmin();
  const params = await searchParams;

  const sender = typeof params.sender === "string" ? params.sender : undefined;
  const unreadOnly = params.unreadOnly === "true";
  const lookbackDays = parseLookbackDays(typeof params.lookbackDays === "string" ? params.lookbackDays : undefined, 30);

  const selection = await resolveMailboxSelection(admin.id, parseMultiValueParam(params.mailboxId));
  const activeMailboxes = selection.mailboxes.filter((mailbox) => mailbox.status === "ACTIVE");
  const activeMailboxIds = new Set(activeMailboxes.map((mailbox) => mailbox.id));
  const selectedMailboxIds = selection.selectedMailboxIds.filter((mailboxId) => activeMailboxIds.has(mailboxId));

  const results =
    selectedMailboxIds.length > 0
      ? await getOtpMonitorData(selectedMailboxIds, {
          sender,
          unreadOnly,
          lookbackDays,
        })
      : [];

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88">
        <CardHeader>
          <CardTitle>Lấy OTP</CardTitle>
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
              <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_8.5rem_auto_auto]">
                <div>
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Người gửi</div>
                  <Input name="sender" defaultValue={sender} placeholder="Người gửi" className="h-10 rounded-xl" />
                </div>
                <div>
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
                <div>
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-transparent">.</div>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_18px_38px_-24px_rgba(44,143,153,0.42)] transition hover:brightness-105"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Lấy OTP mới nhất
                  </button>
                </div>
                <div>
                  <div className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-transparent">.</div>
                  <Link href="/otp" className="control-surface inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-foreground">
                    <Filter className="mr-2 h-4 w-4" />
                    Đặt lại bộ lọc
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="unreadOnly" value="true" defaultChecked={unreadOnly} />
                  Chỉ xét mail chưa đọc
                </label>
              </div>
            </div>
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
            const labels = parseLabelList(result.message?.labels);
            const candidate = result.latestCandidate;

            return (
              <Card key={result.id} className="rounded-[28px] bg-card/88">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline">{result.mailbox?.emailAddress ?? "Mailbox không xác định"}</Badge>
                        {candidate ? <Badge className="semantic-brand rounded-full border hover:brightness-105">{candidate.code}</Badge> : null}
                        {candidate ? <ConfidenceBadge value={candidate.confidenceLabel} /> : null}
                        {labels.includes("UNREAD") ? <Badge variant="outline">Chưa đọc</Badge> : null}
                        {!result.message ? <Badge variant="outline">Chưa có mail đã đồng bộ</Badge> : null}
                        {result.message && !candidate ? <Badge variant="outline">Mail mới nhất không có OTP</Badge> : null}
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{result.message?.subject ?? "Chưa có mail cục bộ"}</p>
                        <p className="text-sm text-muted-foreground">{result.message?.fromHeader || result.mailbox?.displayName || "Không rõ người gửi"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {candidate ? <CopyOtpButton code={candidate.code} /> : null}
                      {result.message ? (
                        <Link href={`/messages/${result.message.id}`} className="control-surface rounded-xl px-3 py-2 text-sm font-medium text-foreground">
                          Mở email
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-sm leading-7 text-muted-foreground">
                        {candidate
                          ? truncate(candidate.contextSnippet, 260)
                          : result.message
                            ? "Đã tìm thấy mail mới nhất, nhưng extractor không phát hiện mã OTP hợp lệ trong nội dung mail này."
                            : "Mailbox này chua có mail c?c b? phù h?p v?i b? l?c hi?n t?i. Hãy d?ng b? tru?c r?i b?m Lấy OTP m?i nh?t l?i."}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>{formatDateTime(result.message?.receivedAt ?? result.mailbox?.lastSyncedAt)}</div>
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
        </div>
      )}
    </div>
  );
}



