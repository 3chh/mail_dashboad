import Link from "next/link";
import { Filter, MailOpen, ShieldCheck } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { CopyOtpButton } from "@/components/otp/copy-otp-button";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MailboxCheckboxGroup } from "@/components/shared/mailbox-checkbox-group";
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
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;
  const unreadOnly = params.unreadOnly === "true";

  const selection = await resolveMailboxSelection(
    admin.id,
    parseMultiValueParam(params.mailboxId),
  );

  const results =
    selection.selectedMailboxIds.length > 0
      ? await getOtpMonitorData(selection.selectedMailboxIds, {
        sender,
        dateFrom,
        dateTo,
        unreadOnly,
      })
      : [];

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] border-border/70 bg-white/75">
        <CardHeader>
          <CardTitle>Lấy OTP</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Lấy OTP từ mail cục bộ mới nhất của từng mailbox được chọn. Trang này không quét toàn bộ lịch sử mail, chỉ đọc mail gần nhất theo bộ lọc hiện tại.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3">
            <MailboxCheckboxGroup
              mailboxes={selection.mailboxes}
              selectedMailboxIds={selection.selectedMailboxIds}
            />
            <div className="grid gap-3 md:grid-cols-4">
              <Input name="sender" defaultValue={sender} placeholder="Người gửi" className="h-11 rounded-2xl" />
              <Input name="dateFrom" type="date" defaultValue={dateFrom} className="h-11 rounded-2xl" />
              <Input name="dateTo" type="date" defaultValue={dateTo} className="h-11 rounded-2xl" />
              <button type="submit" className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Lấy OTP mới nhất
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="unreadOnly" value="true" defaultChecked={unreadOnly} />
                Chỉ xét mail chưa đọc
              </label>
              <Link href="/otp" className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-background px-4 text-sm font-medium">
                <Filter className="mr-2 h-4 w-4" />
                Đặt lại bộ lọc
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {selection.selectedMailboxIds.length === 0 ? (
        <Card className="rounded-[28px] border-border/70 bg-white/75">
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
              <Card key={result.id} className="rounded-[28px] border-border/70 bg-white/75">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline">{result.mailbox?.emailAddress ?? "Mailbox không xác định"}</Badge>
                        {candidate ? <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{candidate.code}</Badge> : null}
                        {candidate ? <ConfidenceBadge value={candidate.confidenceLabel} /> : null}
                        {labels.includes("UNREAD") ? <Badge variant="outline">Chưa đọc</Badge> : null}
                        {!result.message ? <Badge variant="outline">Chưa có mail đã đồng bộ</Badge> : null}
                        {result.message && !candidate ? <Badge variant="outline">Mail m?i nh?t không có OTP</Badge> : null}
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{result.message?.subject ?? "Chưa có mail cục bộ"}</p>
                        <p className="text-sm text-muted-foreground">{result.message?.fromHeader || result.mailbox?.displayName || "Không rõ người gửi"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {candidate ? <CopyOtpButton code={candidate.code} /> : null}
                      {result.message ? (
                        <Link href={`/messages/${result.message.id}`} className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium">
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

