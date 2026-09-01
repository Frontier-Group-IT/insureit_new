import Link from "next/link";
import { CircleAlert, CircleCheck, FilePlus2, Files, ShieldCheck, TriangleAlert } from "lucide-react";

export type VehicleLinkedPolicy = {
  id: string;
  policy_no: string;
  start_date: string;
  end_date: string;
  policy_documents?: { id: string; document_type: string }[] | null;
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
          <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
          Add policy
        </Link>
      </div>
    );
  }

  const state = policyState(policy.end_date);
  const meta = policyMeta(policy.end_date, state);
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
      <Link
        prefetch={false}
        href={`/policies/${encodeURIComponent(policy.id)}/edit`}
        className="max-w-[190px] truncate rounded-md border border-[#D6E1EE] bg-[#F4F7FB] px-2 py-1 font-bold text-[#17365D] transition hover:border-[#B8C9DE] hover:bg-[#EDF3F9] hover:text-[#102A49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9CCE3]"
        title={`Edit policy ${policy.policy_no}`}
      >
        {policy.policy_no}
      </Link>
      <span className="hidden h-5 w-px bg-[#D8E1EC] sm:block" aria-hidden="true" />
      <PolicyStateIcon state={state} />
      <span className="text-[9.5px] font-medium text-[#667085]">{meta}</span>
      {policyCopyId(policy) ? (
        <Link
          prefetch={false}
          href={`/policies/documents/${encodeURIComponent(policyCopyId(policy)!)}/open`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View policy copy for ${policy.policy_no}`}
          title="View policy copy"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[#7C3AED] transition hover:bg-[#E9D5FF] hover:text-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B5FD]"
        >
          <Files className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function PolicyStateIcon({ state }: { state: PolicyState }) {
  if (state === "ACTIVE") {
    return (
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EAF8EF] text-[#1C8A4A]"
        aria-label="Active"
        title="Active"
      >
        <CircleCheck className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
      </span>
    );
  }
  if (state === "DUE") {
    return (
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FFF0EA] text-[#D16A4B]"
        aria-label="Due"
        title="Due"
      >
        <TriangleAlert className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FDEDED] text-[#D14343]"
      aria-label="Expired"
      title="Expired"
    >
      <CircleAlert className="h-4 w-4" strokeWidth={2.3} aria-hidden="true" />
    </span>
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

function policyCopyId(policy: VehicleLinkedPolicy) {
  return policy.policy_documents?.find((document) => document.document_type === "policy_copy")?.id ?? null;
}
