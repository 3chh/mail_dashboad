import { getRequiredAdmin } from "@/lib/auth/get-session";
import { JobsClient } from "@/components/scan-jobs/jobs-client";
import { Card, CardContent } from "@/components/ui/card";
import { getScanJobsData } from "@/lib/queries/app-data";

export default async function ScanJobsPage() {
  const admin = await getRequiredAdmin();
  const jobs = await getScanJobsData(admin.id);

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88">
        <CardContent className="p-6">
          <JobsClient initialJobs={JSON.parse(JSON.stringify(jobs))} />
        </CardContent>
      </Card>
    </div>
  );
}


