import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const paginationButtonClassName =
  "group/button inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] bg-clip-padding px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none select-none control-surface text-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5";

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  buildPageHref,
  itemLabel = "mục",
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  buildPageHref: (page: number) => string;
  itemLabel?: string;
}) {
  if (totalItems <= pageSize) {
    return null;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-border/70 bg-background/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {start}-{end} / {totalItems} {itemLabel}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={buildPageHref(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage <= 1}
          className={cn(
            paginationButtonClassName,
            currentPage <= 1 ? "pointer-events-none opacity-50" : "",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Trước
        </Link>

        <div className="min-w-[6.5rem] text-center text-sm font-medium text-foreground">
          Trang {currentPage} / {totalPages}
        </div>

        <Link
          href={buildPageHref(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage >= totalPages}
          className={cn(
            paginationButtonClassName,
            currentPage >= totalPages ? "pointer-events-none opacity-50" : "",
          )}
        >
          Sau
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
