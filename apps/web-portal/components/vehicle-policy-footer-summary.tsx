import Link from "next/link";
import { ExternalLink, Plus, ShieldCheck } from "lucide-react";

export type VehicleLinkedPolicy = {
  id: string;
  policy_no: string;
  start_date: string;
  end_date: string;
};

type PolicyState = "ACTIVE" | "DUE" | "EXPIRED";

export function VehiclePolicyFooterSummary({
  policies,
  customerId,
  vehicleId,
}: {
  policies: VehicleLinkedPolicy[];
  customerId: string;
  vehicleId: string;
}) {
  const policy = choosePolicy(policies);

  if (!policy) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px]">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F1F5F9] text-[#64748B]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="font-semibold text-[#475569]">No policy linked</span>
        <span className="hidden h-5 w-px bg-[#D8E1EC] sm:block" aria-hidden="true" />
        <Link
          prefetch={false}
          href={`/policies/new?customer_id=${encodeURIComponent(customerId)}&vehicle_id=${encodeURIComponent(vehicleId)}`}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#AFC6E7] bg-[#F8FBFF] px-2.5 font-bold text-[#215EAD] transition hover:border-[#7EA6DB] hover:bg-[#EEF5FF]"
        >
          Add policy <Plus className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const state = policyState(policy.end_date);
  const meta = policyMeta(policy.end_date, state);
  const stateClass =
    state === "ACTIVE"
      ? "border-[#B7E4C7] bg-[#ECFDF3] text-[#16803C]"
      : state === "DUE"
        ? "border-[#F5D38B] bg-[#FFF8E7] text-[#A56500]"
        : "border-[#F4B8B8] bg-[#FFF0F0] text-[#C62828]";
  const iconClass =
    state === "ACTIVE"
      ? "bg-[#ECFDF3] text-[#16803C]"
      : state === "DUE"
        ? "bg-[#FFF8E7] text-[#B77900]"
        : "bg-[#FFF0F0] text-[#C62828]";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[10px]">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${iconClass}`}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="max-w-[190px] truncate font-bold text-[#17203A]" title={policy.policy_no}>{policy.policy_no}</span>
      <span className="hidden h-5 w-px bg-[#D8E1EC] sm:block" aria-hidden="true" />
      <span className={`rounded-md border px-2 py-1 text-[8px] font-extrabold tracking-[0.03em] ${stateClass}`}>{state}</span>
      <span className="text-[9.5px] font-medium text-[#667085]">{meta}</span>
      <Link
        prefetch={false}
        href={`/policies/${encodeURIComponent(policy.id)}`}
        className="inline-flex items-center gap-1 font-bold text-[#2563C7] transition hover:text-[#17365D] hover:underline"
      >
        View policy <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}

function choosePolicy(policies: VehicleLinkedPolicy[]) {
  return [...policies].sort((a, b) => {
    const rank = (policy: VehicleLinkedPolicy) => {
      const state = policyState(policy.end_date);
      return state === "ACTIVE" ? 0 : state === "DUE" ? 1 : 2;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff) return rankDiff;
    return dateTime(b.end_date) - dateTime(a.end_date);
  })[0] ?? null;
}

function policyState(endDate: string): PolicyState {
  const days = daysUntil(endDate);
  return days < 0 ? "EXPIRED" : days <= 30 ? "DUE" : "ACTIVE";
}

function policyMeta(endDate: string, state: PolicyState) {
  const days = daysUntil(endDate);
  if (state === "EXPIRED") return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (state === "DUE") return days === 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}`;
  return `Valid till ${formatDate(endDate)}`;
}

function daysUntil(endDate: string) {
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();
  if (Number.isNaN(end.getTime())) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

function dateTime(value: string) {
  const date = new Date(`${value}T23:59:59`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
