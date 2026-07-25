type SkeletonProps = { variant?: "list" | "file" | "import" | "dashboard" };

const pulse = "relative overflow-hidden rounded-xl bg-[#E9EAF4] before:absolute before:inset-0 before:-translate-x-full before:animate-[insureit-shimmer_1.35s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/75 before:to-transparent";
const panel = "rounded-[22px] border border-white/80 bg-white/76 shadow-[0_18px_55px_rgba(42,46,91,0.07)] backdrop-blur-xl";

export function PageSkeleton({ variant = "list" }: SkeletonProps) {
  if (variant === "file") return <ApplicationFileSkeleton />;
  if (variant === "import") return <ImportWorkspaceSkeleton />;
  if (variant === "dashboard") return <DashboardSkeleton />;
  return <ListPageSkeleton />;
}

export function ListPageSkeleton() {
  return (
    <div className="ui-page-stage mx-auto max-w-[1440px] space-y-4 pb-5" aria-label="Loading records" aria-live="polite">
      <div className={`${panel} flex items-center justify-between gap-4 p-5`}>
        <div className="space-y-2"><div className={`${pulse} h-4 w-64`} /><div className={`${pulse} h-3 w-36`} /></div>
        <div className="flex gap-2"><div className={`${pulse} h-10 w-24`} /><div className={`${pulse} h-10 w-28`} /></div>
      </div>
      <div className={`${panel} grid gap-2 p-3 sm:grid-cols-4`}><div className={`${pulse} h-10 sm:col-span-2`} /><div className={`${pulse} h-10`} /><div className={`${pulse} h-10`} /></div>
      <div className={`${panel} overflow-hidden p-0`}>
        <div className="grid grid-cols-8 gap-3 border-b border-[#E8EAF2] bg-[#F8F8FD] px-4 py-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className={`${pulse} h-3`} />)}</div>
        <div className="divide-y divide-[#EFF0F6]">{Array.from({ length: 7 }).map((_, row) => <div key={row} className="grid grid-cols-8 gap-3 px-4 py-4">{Array.from({ length: 8 }).map((__, index) => <div key={index} className={`${pulse} h-3`} />)}</div>)}</div>
      </div>
    </div>
  );
}

export function ApplicationFileSkeleton() {
  return (
    <div className="ui-page-stage mx-auto max-w-[1280px] space-y-4 pb-8" aria-label="Loading application file" aria-live="polite">
      <div className={`${panel} p-5`}><div className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><div className={`${pulse} h-3 w-36`} /><div className={`${pulse} h-7 w-80`} /><div className={`${pulse} h-3 w-52`} /></div><div className="flex gap-2"><div className={`${pulse} h-8 w-20 rounded-full`} /><div className={`${pulse} h-8 w-24 rounded-full`} /></div></div></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, section) => <div key={section} className={`${panel} p-5`}><div className={`${pulse} h-4 w-48`} /><div className="mt-4 grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }).map((__, field) => <div key={field} className={`${pulse} h-14`} />)}</div></div>)}</div>
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, card) => <div key={card} className={`${panel} p-4`}><div className={`${pulse} h-4 w-32`} /><div className="mt-4 space-y-3">{Array.from({ length: 4 }).map((__, row) => <div key={row} className={`${pulse} h-10`} />)}</div></div>)}</div>
      </div>
    </div>
  );
}

export function ImportWorkspaceSkeleton() {
  return <div className="ui-page-stage mx-auto max-w-[1480px] space-y-4 pb-6" aria-label="Loading import workspace" aria-live="polite"><div className={`${panel} p-5`}><div className={`${pulse} h-5 w-72`} /><div className={`${pulse} mt-2 h-3 w-96`} /></div><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className={`${panel} p-4`}><div className={`${pulse} h-3 w-24`} /><div className={`${pulse} mt-3 h-7 w-16`} /></div>)}</div><ListPageSkeleton /></div>;
}

export function DashboardSkeleton() {
  return <div className="ui-page-stage space-y-4" aria-label="Loading dashboard" aria-live="polite"><div className={`${panel} h-40 p-5`}><div className={`${pulse} h-3 w-32`} /><div className={`${pulse} mt-4 h-8 w-80`} /><div className={`${pulse} mt-3 h-3 w-52`} /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,index)=><div key={index} className={`${panel} p-5`}><div className={`${pulse} h-3 w-28`} /><div className={`${pulse} mt-4 h-8 w-20`} /><div className={`${pulse} mt-5 h-3 w-full`} /></div>)}</div><div className="grid gap-4 xl:grid-cols-2"><div className={`${panel} h-72`} /><div className={`${panel} h-72`} /></div></div>;
}
