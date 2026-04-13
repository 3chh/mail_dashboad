import { getRequiredAdmin } from "@/lib/auth/get-session";
import { JobsClient } from "@/components/scan-jobs/jobs-client";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Card, CardContent } from "@/components/ui/card";
import { paginateArray, parsePageParam, createSearchParams } from "@/lib/pagination";
import { getScanJobsData } from "@/lib/queries/app-data";

type ScanJobsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SCAN_JOBS_PAGE_SIZE = 5;

export default async function ScanJobsPage({ searchParams }: ScanJobsPageProps) {
  const admin = await getRequiredAdmin();
  const params = await searchParams;
  const page = parsePageParam(params.page, 1);
  const jobs = await getScanJobsData(admin.id);
  const pagedJobs = paginateArray(jobs, page, SCAN_JOBS_PAGE_SIZE);

  function buildPageHref(nextPage: number) {
    const nextParams = createSearchParams(params);
    if (nextPage <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(nextPage));
    }
    const query = nextParams.toString();
    return query ? `/scan-jobs?${query}` : "/scan-jobs";
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] bg-card/88">
        <CardContent className="p-6">
          <JobsClient
            initialJobs={JSON.parse(JSON.stringify(pagedJobs.items))}
            currentPage={pagedJobs.currentPage}
            pageSize={pagedJobs.pageSize}
          />
        </CardContent>
      </Card>

      <PaginationControls
        currentPage={pagedJobs.currentPage}
        totalPages={pagedJobs.totalPages}
        totalItems={pagedJobs.totalItems}
        pageSize={pagedJobs.pageSize}
        itemLabel="lượt đồng bộ"
        buildPageHref={buildPageHref}
      />
    </div>
  );
}
