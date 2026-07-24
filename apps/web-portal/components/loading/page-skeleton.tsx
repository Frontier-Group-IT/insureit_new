type SkeletonProps = { variant?: "list" | "file" | "import" };

const pulse = "animate-pulse rounded-md bg-[#E8EEF5]";

export function PageSkeleton({ variant = "list" }: SkeletonProps) {
  if (variant === "file") return <ApplicationFileSkeleton />;
  if (variant === "import") return <ImportWorkspaceSkeleton />;
  return <ListPageSkeleton />;
}

export function ListPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-3 pb-4" aria-label="Loading records">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2"><div className={`${pulse} h-4 w-64`} /><div className={`${pulse} h-3 w-32`} /></div>
        <div className="flex gap-2"><div className={`${pulse} h-9 w-24`} /><div className={`${pulse} h-9 w-24`} /></div>
      </div>
      <div className="grid gap-2 rounded-xl border border-[#DCE5EF] bg-white p-3 sm:grid-cols-4">
        <div className={`${pulse} h-9 sm:col-span-2`} /><div className={`${pulse} h-9`} /><div className={`${pulse} h-9`} />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
        <div className="grid grid-cols-8 gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className={`${pulse} h-3`} />)}</div>
        <div className="divide-y divide-[#EEF2F6]">{Array.from({ length: 7 }).map((_, row) => <div key={row} className="grid grid-cols-8 gap-3 px-4 py-4">{Array.from({ length: 8 }).map((__, index) => <div key={index} className={`${pulse} h-3`} />)}</div>)}</div>
      </div>
    </div>
  );
}

export function ApplicationFileSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-4 pb-8" aria-label="Loading application file">
      <div className="rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2"><div className={`${pulse} h-3 w-36`} /><div className={`${pulse} h-7 w-80`} /><div className={`${pulse} h-3 w-52`} /></div>
          <div className="flex gap-2"><div className={`${pulse} h-7 w-20 rounded-full`} /><div className={`${pulse} h-7 w-24 rounded-full`} /></div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, section) => <div key={section} className="rounded-2xl border border-[#DCE5EF] bg-white p-5"><div className={`${pulse} h-4 w-48`} /><div className="mt-4 grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }).map((__, field) => <div key={field} className={`${pulse} h-14`} />)}</div></div>)}</div>
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, card) => <div key={card} className="rounded-2xl border border-[#DCE5EF] bg-white p-4"><div className={`${pulse} h-4 w-32`} /><div className="mt-4 space-y-3">{Array.from({ length: 4 }).map((__, row) => <div key={row} className={`${pulse} h-10`} />)}</div></div>)}</div>
      </div>
    </div>
  );
}

export function ImportWorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-[1480px] space-y-4 pb-6" aria-label="Loading import workspace">
      <div className="rounded-2xl border border-[#DCE5EF] bg-white p-5"><div className={`${pulse} h-5 w-72`} /><div className={`${pulse} mt-2 h-3 w-96`} /></div>
      <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="rounded-xl border border-[#E2E8F0] bg-white p-4"><div className={`${pulse} h-3 w-24`} /><div className={`${pulse} mt-3 h-7 w-16`} /></div>)}</div>
      <ListPageSkeleton />
    </div>
  );
}
