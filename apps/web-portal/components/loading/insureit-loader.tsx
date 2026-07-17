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
    <span className="inline-flex items-center gap-2" data-insureit-loader="true">
      <span className="relative h-4 w-7 overflow-hidden">
        <span className="absolute bottom-0 left-0 h-2.5 w-4 rounded-sm bg-white/90" />
        <span className="absolute bottom-0 left-4 h-3 w-2.5 rounded-r-sm rounded-t-sm bg-white" />
        <span className="absolute bottom-[-1px] left-1 h-1.5 w-1.5 rounded-full bg-[#071D49]" />
        <span className="absolute bottom-[-1px] left-5 h-1.5 w-1.5 rounded-full bg-[#071D49]" />
      </span>
      <span>{label}</span>
    </span>
  );
}
