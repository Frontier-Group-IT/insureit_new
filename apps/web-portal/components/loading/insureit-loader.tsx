export function InsureItLoader({ label = "Loading", sublabel = "", compact = false }: { label?: string; sublabel?: string; compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center text-left ${compact ? "gap-3" : "flex-col gap-3 text-center"}`}
      role="status"
      aria-live="polite"
      data-insureit-loader="true"
    >
      <div className={`relative overflow-hidden ${compact ? "h-10 w-28" : "h-16 w-44"}`}>
        <div className="absolute inset-x-0 bottom-2 h-[2px] rounded-full bg-[#AFC0D5]" />
        <div className="absolute inset-x-0 bottom-[5px] flex justify-around opacity-70">
          <span className="h-0.5 w-5 rounded bg-white" />
          <span className="h-0.5 w-5 rounded bg-white" />
          <span className="h-0.5 w-5 rounded bg-white" />
          <span className="h-0.5 w-5 rounded bg-white" />
        </div>
        <div className="absolute bottom-3 left-0 animate-[insureit-truck_1.8s_ease-in-out_infinite]">
          <div className="relative h-7 w-14">
            <div className="absolute bottom-1 left-0 h-4 w-8 rounded-sm bg-[#0B4C8C] shadow-sm" />
            <div className="absolute bottom-1 left-8 h-5 w-5 rounded-r-md rounded-t-md bg-[#F59E0B] shadow-sm" />
            <div className="absolute bottom-[11px] left-[36px] h-2 w-3 rounded-sm bg-[#DFF3FF]" />
            <div className="absolute bottom-0 left-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#071D49] shadow" />
            <div className="absolute bottom-0 left-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#071D49] shadow" />
            <div className="absolute bottom-3 -right-2 h-1 w-1 rounded-full bg-[#20C997] animate-[insureit-blip_0.8s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
      <div>
        <p className={`${compact ? "text-[11px]" : "text-[14px]"} font-semibold text-[#071D49]`}>{label}</p>
        {!compact && sublabel ? <p className="mt-1 text-[11px] text-[#526178]">{sublabel}</p> : null}
      </div>
    </div>
  );
}

export function InsureItButtonLoader({ label = "Working" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" data-insureit-progress="true">
      <span className="relative grid h-4 w-4 place-items-center rounded-full bg-white/20 ring-1 ring-white/40">
        <span className="absolute h-2.5 w-2.5 animate-[insureit-work-pulse_.85s_ease-in-out_infinite] rounded-sm border border-white/90" />
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      <span>{label}</span>
    </span>
  );
}

export function InsureItInlineWork({ label = "Working" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#071D49]" data-insureit-progress="true">
      <span className="relative h-2 w-12 overflow-hidden rounded-full bg-[#E2E8F0]">
        <span className="absolute inset-y-0 left-0 w-8 animate-[insureit-sheen_1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#071D49] via-[#D8A31A] to-[#20C997]" />
      </span>
      <span>{label}</span>
    </span>
  );
}

export function BlockingWorkPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[#C7D2FE] bg-gradient-to-r from-[#F8FAFF] via-white to-[#F0FDF9] px-4 py-3 shadow-sm" data-insureit-progress="true">
      <div className="flex items-center gap-3">
        <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#071D49] text-white shadow-sm">
          <span className="absolute inset-0 animate-[insureit-sheen_1.3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <span className="relative h-4 w-4 rounded-sm border border-white/90" />
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold text-[#071D49]">{title}</span>
          <span className="mt-0.5 block text-[10.5px] text-[#526178]">{detail}</span>
        </span>
      </div>
    </div>
  );
}
