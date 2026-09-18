import { ChevronDown } from "lucide-react";

export type StandardActivityItem = {
  id: string;
  title: string;
  meta?: string | null;
  at?: string | null;
};

const timestampFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return timestampFormatter.format(date);
}

export function StandardActivityStatusCard({
  items,
  emptyText = "No activity recorded yet.",
  open = false,
}: {
  items: StandardActivityItem[];
  emptyText?: string;
  open?: boolean;
}) {
  return (
    <details
      open={open}
      className="group overflow-hidden rounded-2xl border border-[#DDE4EE] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.035)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[10.5px] font-semibold text-[#334155] [&::-webkit-details-marker]:hidden">
        <span>Activity Status</span>
        <ChevronDown className="h-4 w-4 text-[#64748B] transition group-open:rotate-180" />
      </summary>

      <div className="border-t border-[#E6EBF1] px-4 py-3">
        <div className="overflow-hidden rounded-xl border border-[#DDE4EE] bg-[#FBFCFE]">
          {items.length ? (
            items.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 border-b border-[#E6EBF1] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[8px] font-bold uppercase tracking-[0.06em] text-[#8190A4]">
                    {index === 0 ? "Latest Action" : "Previous Action"}
                  </p>
                  <p className="mt-1 truncate text-[12px] font-semibold text-[#183A64]">{item.title}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-7 gap-y-1 text-[9px] text-[#8190A4]">
                  {item.meta ? <span>Details: {item.meta}</span> : null}
                  <span>At: {formatTimestamp(item.at)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-5 text-[10.5px] text-[#7A899F]">{emptyText}</div>
          )}
        </div>
      </div>
    </details>
  );
}
