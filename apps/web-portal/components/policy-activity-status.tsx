type PolicyActivityStatusProps = {
  status: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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

function displayStatus(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) return "Not recorded";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return timestampFormatter.format(date);
}

function statusTone(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "active") return "border-[#BFE8D5] bg-[#F0FBF6] text-[#14845B]";
  if (normalized === "expired" || normalized === "cancelled" || normalized === "inactive") return "border-[#F1C5C7] bg-[#FFF4F4] text-[#B4232C]";
  if (normalized === "expiring" || normalized === "pending" || normalized === "on hold") return "border-[#F1D59A] bg-[#FFF9EB] text-[#A96A00]";
  return "border-[#D5E0EF] bg-[#EEF3FA] text-[#17365D]";
}

function ActivityMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[#F8FAFC] px-3 py-2">
      <p className="text-[7.5px] font-bold uppercase tracking-[0.06em] text-[#98A2B3]">{label}</p>
      <p className="mt-1 truncate text-[9px] font-medium text-[#475467]" title={value}>{value}</p>
    </div>
  );
}

export function PolicyActivityStatus({ status, createdBy, createdAt, updatedAt }: PolicyActivityStatusProps) {
  const creator = createdBy?.trim() || "Not recorded";

  return (
    <details className="group overflow-hidden rounded-xl border border-[#D9E2F0] bg-white shadow-sm">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 bg-[#FBFCFE] px-4 py-2 text-[#17365D] transition hover:bg-[#F7F9FC] [&::-webkit-details-marker]:hidden">
        <span className="text-[10px] font-semibold">Activity Status</span>
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#D5E0EF] bg-white text-[#667085] transition group-open:rotate-180" aria-hidden="true">
          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 8 4 4 4-4" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-[#E7ECF2] px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex min-h-[50px] items-center gap-2.5 rounded-lg bg-[#F8FAFC] px-3 py-2">
            <span className="text-[7.5px] font-bold uppercase tracking-[0.06em] text-[#98A2B3]">Status</span>
            <span className={`inline-flex min-h-7 items-center rounded-lg border px-3 text-[10px] font-bold ${statusTone(status)}`}>
              {displayStatus(status)}
            </span>
          </div>
          <ActivityMeta label="Created By" value={creator} />
          <ActivityMeta label="Created At" value={formatTimestamp(createdAt)} />
          <ActivityMeta label="Updated At" value={formatTimestamp(updatedAt)} />
        </div>
      </div>
    </details>
  );
}
