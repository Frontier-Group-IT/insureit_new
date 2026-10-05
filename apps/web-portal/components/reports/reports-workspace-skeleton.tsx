function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#edf2f7] ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="min-h-[108px] border-b border-[#e4e9f0] px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="mt-3 h-7 w-24" />
      <SkeletonBlock className="mt-3 h-2.5 w-28" />
    </div>
  );
}

function CardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <article className="overflow-hidden rounded-[10px] border border-[#dfe6ef] bg-white">
      <div className="flex min-h-12 items-center justify-between border-b border-[#e6ebf2] px-4 py-3">
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-8 w-24 rounded-md" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid grid-cols-[28px_minmax(110px,1fr)_minmax(120px,1.4fr)_56px] items-center gap-3">
            <SkeletonBlock className="h-2.5 w-4" />
            <div className="space-y-2">
              <SkeletonBlock className="h-2.5 w-[82%]" />
              <SkeletonBlock className="h-2 w-[58%]" />
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="h-2.5 w-full" />
              <SkeletonBlock className="h-2 w-[72%]" />
            </div>
            <SkeletonBlock className="ml-auto h-2.5 w-10" />
          </div>
        ))}
      </div>
    </article>
  );
}

function ChartSkeleton() {
  return (
    <article className="overflow-hidden rounded-[10px] border border-[#dfe6ef] bg-white">
      <div className="flex min-h-12 items-center justify-between border-b border-[#e6ebf2] px-4 py-3">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-8 w-28 rounded-md" />
      </div>
      <div className="p-4">
        <div className="mb-4 flex gap-4">
          <SkeletonBlock className="h-2.5 w-24" />
          <SkeletonBlock className="h-2.5 w-20" />
        </div>
        <div className="relative h-[190px] overflow-hidden rounded-md bg-[#fbfcfe]">
          <div className="absolute inset-x-0 top-[18%] border-t border-[#edf1f5]" />
          <div className="absolute inset-x-0 top-[38%] border-t border-[#edf1f5]" />
          <div className="absolute inset-x-0 top-[58%] border-t border-[#edf1f5]" />
          <div className="absolute inset-x-0 top-[78%] border-t border-[#edf1f5]" />
          <div className="absolute bottom-5 left-[5%] h-2 w-[12%] animate-pulse rounded bg-[#e8eef5]" />
          <div className="absolute bottom-[34%] left-[24%] h-2 w-[16%] animate-pulse rounded bg-[#e8eef5]" />
          <div className="absolute bottom-[58%] left-[46%] h-2 w-[18%] animate-pulse rounded bg-[#e8eef5]" />
          <div className="absolute bottom-[76%] left-[70%] h-2 w-[15%] animate-pulse rounded bg-[#e8eef5]" />
        </div>
      </div>
    </article>
  );
}

function TableSkeleton() {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#dfe6ef] bg-white">
      <div className="flex min-h-12 items-center justify-between border-b border-[#e6ebf2] px-4 py-3">
        <SkeletonBlock className="h-3 w-36" />
        <SkeletonBlock className="h-3 w-16" />
      </div>
      <div className="px-4 py-2">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr_0.8fr] gap-4 border-b border-[#edf1f5] py-2.5">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonBlock key={index} className="h-2.5 w-[74%]" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr_0.8fr] gap-4 border-b border-[#f0f3f7] py-3 last:border-b-0">
            {Array.from({ length: 5 }, (_, cell) => (
              <SkeletonBlock key={cell} className={cell === 0 ? "h-3 w-[88%]" : "h-3 w-[70%]"} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReportsWorkspaceSkeleton() {
  return (
    <div
      className="reports-reference-content space-y-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading report data"
    >
      <section className="overflow-hidden rounded-[10px] border border-[#dfe6ef] bg-white">
        <div className="grid sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <KpiSkeleton key={index} />
          ))}
        </div>
      </section>
      <section className="grid gap-3 xl:grid-cols-2">
        <ChartSkeleton />
        <CardSkeleton rows={4} />
      </section>
      <section className="grid gap-3 xl:grid-cols-2">
        <CardSkeleton rows={5} />
        <ChartSkeleton />
      </section>
      <TableSkeleton />
      <span className="sr-only">Loading report data</span>
    </div>
  );
}
