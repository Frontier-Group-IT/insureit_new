import { loadCustomerActivityHistory } from "@/lib/customer-activity";

type CustomerActivityStatusProps = {
  customerId: string;
  createdById: string | null;
  createdByName?: string | null;
  createdAt: string | null;
  creationChannel: string | null;
  originCustomerId: string | null;
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

export async function CustomerActivityStatus(props: CustomerActivityStatusProps) {
  const activities = await loadCustomerActivityHistory(props);

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
        {activities.length ? (
          <div className="overflow-hidden rounded-lg border border-[#E7ECF2] bg-[#F8FAFC]">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className={`grid min-w-0 gap-x-4 gap-y-1 px-3 py-2.5 md:grid-cols-[minmax(150px,1fr)_minmax(120px,auto)_minmax(150px,auto)_minmax(140px,auto)_auto] md:items-center ${index ? "border-t border-[#E7ECF2]" : ""}`}
              >
                <div className="min-w-0">
                  <p className="text-[7.5px] font-bold uppercase tracking-[0.06em] text-[#98A2B3]">{index === 0 ? "Latest Action" : "Previous Action"}</p>
                  <p className="mt-1 text-[11px] font-bold text-[#17365D]">{activity.action}</p>
                </div>
                <ActivityMeta label="Created By" value={activity.actorName} />
                <ActivityMeta label="Via" value={activity.via ?? "—"} />
                <ActivityMeta label="Under" value={activity.under ?? "—"} />
                <ActivityMeta label="At" value={formatTimestamp(activity.at)} alignRight />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-[#F8FAFC] px-3 py-2.5 text-[9px] font-medium text-[#667085]">Activity not recorded</div>
        )}
      </div>
    </details>
  );
}

function ActivityMeta({ label, value, alignRight = false }: { label: string; value: string; alignRight?: boolean }) {
  return (
    <div className={`min-w-0 text-[8.5px] font-medium text-[#667085] ${alignRight ? "md:text-right" : ""}`}>
      <span className="text-[#98A2B3]">{label}: </span>
      <span className="break-words">{value}</span>
    </div>
  );
}
