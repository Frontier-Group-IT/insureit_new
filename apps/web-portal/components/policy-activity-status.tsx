type PolicyActivityStatusProps = {
  status: string | null;
  createdBy: string | null;
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

export function PolicyActivityStatus({ status, createdBy, updatedAt }: PolicyActivityStatusProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm" aria-labelledby="policy-activity-status-heading">
      <div className="flex min-h-11 items-center border-b border-[#E7ECF2] bg-[#FBFCFE] px-4 py-2">
        <h2 id="policy-activity-status-heading" className="text-[12px] font-semibold text-[#17365D]">Activity Status</h2>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[8px] font-bold uppercase tracking-[0.07em] text-[#98A2B3]">Status</span>
          <span className={`inline-flex min-h-7 items-center rounded-lg border px-3 text-[10px] font-bold ${statusTone(status)}`}>
            {displayStatus(status)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[9px] text-[#667085]">
          <span><span className="font-semibold text-[#475467]">Created By:</span> {createdBy?.trim() || "Not recorded"}</span>
          <span><span className="font-semibold text-[#475467]">Updated At:</span> {formatTimestamp(updatedAt)}</span>
        </div>
      </div>
    </section>
  );
}
