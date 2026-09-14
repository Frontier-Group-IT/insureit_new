import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

type PartnerPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  previousHref?: string | null;
  nextHref?: string | null;
  className?: string;
};

export function PartnerPagination({
  page,
  pageSize,
  total,
  previousHref,
  nextHref,
  className = "",
}: PartnerPaginationProps) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = Math.min((safePage - 1) * pageSize + 1, total);
  const end = Math.min(safePage * pageSize, total);
  const hasPrevious = Boolean(previousHref) && safePage > 1;
  const hasNext = Boolean(nextHref) && safePage < totalPages;

  const buttonBase =
    "inline-flex min-h-9 items-center gap-2 rounded-lg border px-3.5 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20";

  return (
    <div className={`flex flex-col gap-3 border-t border-[#E6ECF3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}>
      <p className="text-[10px] font-medium text-[#6F8198]">
        Showing {start}-{end} of {total}
      </p>

      <div className="flex items-center gap-3 self-end sm:self-auto">
        <Link
          href={hasPrevious ? previousHref! : "#"}
          aria-disabled={!hasPrevious}
          className={`${buttonBase} ${hasPrevious ? "border-[#D2DCE9] bg-white text-[#203653] hover:bg-[#F8FAFD]" : "pointer-events-none border-[#E5EAF0] bg-[#FAFBFC] text-[#AAB4C2]"}`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Previous
        </Link>

        <span className="min-w-[44px] text-center text-[10px] font-bold text-[#536680]">
          {safePage} / {totalPages}
        </span>

        <Link
          href={hasNext ? nextHref! : "#"}
          aria-disabled={!hasNext}
          className={`${buttonBase} ${hasNext ? "border-[#D2DCE9] bg-white text-[#203653] hover:bg-[#F8FAFD]" : "pointer-events-none border-[#E5EAF0] bg-[#FAFBFC] text-[#AAB4C2]"}`}
        >
          Next
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
