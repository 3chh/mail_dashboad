import { ActivitySquare } from "lucide-react";
import { getRequiredAdmin } from "@/lib/auth/get-session";
import { JobsClient } from "@/components/scan-jobs/jobs-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getScanJobsData } from "@/lib/queries/app-data";

export default async function ScanJobsPage() {
  const admin = await getRequiredAdmin();
  const jobs = await getScanJobsData(admin.id);

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] border-border/70 bg-white/75">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivitySquare className="h-5 w-5 text-primary" />
            Lịch sử đồng bộ
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Mỗi job đồng bộ gắn với một mailbox và chỉ đồng bộ mail về local store. Tìm kiếm và lấy OTP được xử lý riêng trên dữ liệu đã đồng bộ.
          </p>
        </CardHeader>
        <CardContent>
          <JobsClient initialJobs={JSON.parse(JSON.stringify(jobs))} />
        </CardContent>
      </Card>
    </div>
  );
}
