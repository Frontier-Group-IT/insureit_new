import { IntermediaryRegister } from "../intermediary-register";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Period = "all" | "mtd" | "last_month" | "custom";
type Query = {
  q?: string;
  account_status?: string;
  registration_status?: string;
  portal_access?: string;
  success?: string;
  error?: string;
  period?: string;
  from?: string;
  to?: string;
};

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export default async function BusinessAssociatesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  // The register uses India's local business day; this is not the server's UTC day.
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  const mtdFrom = today.slice(0, 8) + "01";
  const lastMonthEnd = new Date(Date.parse(mtdFrom + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  const lastMonthFrom = lastMonthEnd.slice(0, 8) + "01";

  const requestedPeriod: Period =
    q.period === "mtd" || q.period === "last_month" || q.period === "custom" ? q.period : "all";
  const validCustomRange = validDate(q.from) && validDate(q.to) && q.from <= q.to;
  const period: Period = requestedPeriod === "custom" && !validCustomRange ? "all" : requestedPeriod;
  // Use inclusive unrestricted SQL date bounds for All without changing the
  // existing issuance-date RPC, premium attribution, payout or ranking rules.
  const periodFrom = period === "mtd" ? mtdFrom
    : period === "last_month" ? lastMonthFrom
    : period === "custom" ? q.from! : "0001-01-01";
  const periodTo = period === "mtd" ? today
    : period === "last_month" ? lastMonthEnd
    : period === "custom" ? q.to! : "9999-12-31";
  return (
    <IntermediaryRegister
      selectedType="partner"
      search={q.q?.trim().slice(0, 80) ?? ""}
      accountStatus={q.account_status ?? ""}
      registrationStatus={q.registration_status ?? ""}
      portalAccess={q.portal_access ?? ""}
      success={q.success}
      error={q.error}
      periodFrom={periodFrom}
      periodTo={periodTo}
      defaultPeriodFrom={periodFrom}
      defaultPeriodTo={periodTo}
      selectedPeriod={period}
      selectedCustomFrom={period === "custom" ? q.from : undefined}
      selectedCustomTo={period === "custom" ? q.to : undefined}
    />
  );
}
