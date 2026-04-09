import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/get-session";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMessageDetailData } from "@/lib/queries/app-data";
import { formatCurrency, formatDateTime, parseLabelList } from "@/lib/utils";

type MessagePageProps = {
  params: Promise<{ messageId: string }>;
};

export default async function MessageDetailPage({ params }: MessagePageProps) {
  await getRequiredSession();
  const { messageId } = await params;

  const data = await getMessageDetailData(messageId).catch(() => null);
  if (!data) {
    notFound();
  }

  const labels = parseLabelList(data.message.labels);

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88">
        <CardHeader>
          <CardTitle>{data.message.subject ?? "No subject"}</CardTitle>
          <p className="text-sm text-muted-foreground">{data.message.fromHeader || "Unknown sender"}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full">
              {data.message.mailbox.emailAddress}
            </Badge>
            {labels.map((label) => (
              <Badge key={label} variant="outline" className="rounded-full">
                {label}
              </Badge>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Received</p>
              <p className="mt-2 text-sm">{formatDateTime(data.message.receivedAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Remote id</p>
              <p className="mt-2 break-all text-sm">{data.message.remoteMessageId}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Thread</p>
              <p className="mt-2 break-all text-sm">{data.message.remoteThreadId ?? "n/a"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Attachments</p>
              <p className="mt-2 text-sm">{data.message.hasAttachments ? "Yes" : "No"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[28px] bg-card/88">
          <CardContent className="p-6">
            <Tabs defaultValue={data.message.htmlBody ? "html" : "plain"} className="space-y-4">
              <TabsList className="rounded-2xl">
                <TabsTrigger value="plain">Text</TabsTrigger>
                <TabsTrigger value="html" disabled={!data.message.htmlBody}>
                  HTML
                </TabsTrigger>
                <TabsTrigger value="debug">Debug</TabsTrigger>
              </TabsList>

              <TabsContent value="plain">
                <pre className="subpanel-surface max-h-[680px] overflow-auto rounded-3xl p-5 text-sm whitespace-pre-wrap">
                  {data.message.plainTextBody ?? data.message.normalizedText ?? data.message.snippet ?? "No plain text body."}
                </pre>
              </TabsContent>

              <TabsContent value="html">
                {data.message.htmlBody ? (
                  <iframe
                    title="HTML email preview"
                    sandbox=""
                    srcDoc={data.message.htmlBody}
                    className="h-[680px] w-full rounded-3xl border border-border/60 bg-white"
                  />
                ) : (
                  <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                    Message does not have an HTML part.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="debug">
                <pre className="subpanel-surface max-h-[680px] overflow-auto rounded-3xl p-5 text-xs whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      headers: JSON.parse(data.message.rawHeadersJson ?? "[]"),
                      payload: JSON.parse(data.message.rawPayloadJson ?? "{}"),
                    },
                    null,
                    2,
                  )}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[28px] bg-card/88">
            <CardHeader>
              <CardTitle>OTP detections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.otpDetections.length > 0 ? (
                data.otpDetections.map((otp) => (
                  <div key={otp.id} className="subpanel-surface rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-semibold">{otp.code}</p>
                      <ConfidenceBadge value={otp.confidenceLabel} />
                    </div>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{otp.contextSnippet}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có OTP detection.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] bg-card/88">
            <CardHeader>
              <CardTitle>Order extraction</CardTitle>
            </CardHeader>
            <CardContent>
              {data.orderExtraction ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <ConfidenceBadge value={data.orderExtraction.confidenceLabel} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Order id</span>
                    <span>{data.orderExtraction.orderId ?? "none"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Merchant</span>
                    <span>{data.orderExtraction.merchantName ?? "none"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span>{data.orderExtraction.orderStatus ?? "none"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span>{formatCurrency(data.orderExtraction.totalAmount, data.orderExtraction.currency ?? "USD")}</span>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Item summary</p>
                    <p className="mt-2 leading-7">{data.orderExtraction.itemSummary ?? "none"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có order extraction.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
