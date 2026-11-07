import { IntermediaryRegister } from "../intermediary-register";
export const dynamic = "force-dynamic";
export const revalidate = 0;
type Query = { q?: string; account_status?: string; registration_status?: string; portal_access?: string; success?: string; error?: string };
export default async function BusinessAssociatesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  // The register uses India's local business day; this is not the server's UTC day.
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  const mtdFrom = today.slice(0, 8) + "01";
  return (
    <IntermediaryRegister
      selectedType="partner"
      search={q.q?.trim().slice(0, 80) ?? ""}
      accountStatus={q.account_status ?? ""}
      registrationStatus={q.registration_status ?? ""}
      portalAccess={q.portal_access ?? ""}
      success={q.success}
      error={q.error}
      periodFrom={mtdFrom}
      periodTo={today}
      defaultPeriodFrom={mtdFrom}
      defaultPeriodTo={today}
    />
  );
}
