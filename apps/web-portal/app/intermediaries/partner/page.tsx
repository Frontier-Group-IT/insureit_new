import { IntermediaryRegister } from "../intermediary-register";
export const dynamic = "force-dynamic";
export const revalidate = 0;
type Query = { q?: string; account_status?: string; registration_status?: string; portal_access?: string; success?: string; error?: string; from?: string; to?: string };
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value?: string): value is string {
  if (!value || !isoDate.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export default async function BusinessAssociatesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  // The register uses India's local business day; this is not the server's UTC day.
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  const mtdFrom = today.slice(0, 8) + "01";
  const customValid = validDate(q.from) && validDate(q.to) && q.from <= q.to;
  const periodFrom = customValid ? q.from! : mtdFrom;
  const periodTo = customValid ? q.to! : today;
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
      defaultPeriodFrom={mtdFrom}
      defaultPeriodTo={today}
    />
  );
}
