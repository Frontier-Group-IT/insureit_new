import { loadLatestPolicyActivity } from "@/lib/policy-activity";

type PolicyActivityStatusProps = {
  policyId: string;
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

function formatTimestamp(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return timestampFormatter.format(date);
}

export async function PolicyActivityStatus({ policyId, createdBy, createdAt, updatedAt }: PolicyActivityStatusProps) {
  const activity = await loadLatestPolicyActivity({ policyId, createdBy, createdAt, updatedAt });

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
        <div className="min-w-0 rounded-lg bg-[#F8FAFC] px-3 py-2">
          <p className="text-[7.5px] font-bold uppercase tracking-[0.06em] text-[#98A2B3]">Latest Action</p>
          <p className="mt-1 text-[11px] font-bold text-[#17365D]">{activity.action}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-[8.5px] font-medium text-[#667085]">
          <span><span className="text-[#98A2B3]">Created By:</span> {activity.actorName}</span>
          <span><span className="text-[#98A2B3]">Created At:</span> {formatTimestamp(activity.at)}</span>
        </div>
      </div>
    </details>
  );
}
