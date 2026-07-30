import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getAccessibleIntermediaryIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { hasCapability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createIntermediaryPortalLogin } from "./portal-account-actions";
import { resendIntermediaryPortalInvite } from "./resend-portal-invite-action";

export type IntermediaryType = "posp" | "misp" | "partner";
type IntermediaryRow = { id: string; intermediary_code: string | null; onboarding_id: string | null; intermediary_type: IntermediaryType; requested_type: "posp" | "misp"; display_name: string; mobile: string | null; email: string | null; city: string | null; iib_status: string; compliance_status: string; account_status: string; portal_access_status: string; visibility_level: string; application_id: string | null; updated_at: string };
type ApplicationState = { id: string; registration_status: string; partner_status: string | null; requested_type: "posp" | "misp"; final_type: string | null; draft_data: Record<string, unknown> | null };
type Filters = { search?: string; accountStatus?: string; registrationStatus?: string; portalAccess?: string; typeFilter?: IntermediaryType | null; success?: string; error?: string };
const REGISTERED_STATUS = "iib_registered";

export async function IntermediaryRegister({ selectedType, search = "", accountStatus = "", registrationStatus = "", portalAccess = "", typeFilter = null, success, error }: { selectedType: IntermediaryType | null } & Filters) {
  const profile = await requirePospMispManager();
  const admin = createSupabaseAdminClient();
  const effectiveType = selectedType ?? typeFilter;
  const accessibleIds = await getAccessibleIntermediaryIds(profile!.id, profile!.role);
  const canReview = hasCapability(profile!.role, "review_intermediary_application");
  const canCreate = hasCapability(profile!.role, "create_intermediary_application");

  let request = admin.from("intermediaries").select("id,intermediary_code,onboarding_id,intermediary_type,requested_type,display_name,mobile,email,city,iib_status,compliance_status,account_status,portal_access_status,visibility_level,application_id,updated_at").order("updated_at", { ascending: false }).limit(250);
  if (accessibleIds !== null) request = accessibleIds.length ? request.in("id", accessibleIds) : request.in("id", ["00000000-0000-0000-0000-000000000000"]);
  if (effectiveType && effectiveType !== "partner") request = request.eq("intermediary_type", effectiveType);
  if (accountStatus) request = request.eq("account_status", accountStatus);
  if (portalAccess) request = request.eq("portal_access_status", portalAccess);
  if (search) request = request.or(`display_name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%,intermediary_code.ilike.%${search}%`);

  const { data, error: loadError } = await request.returns<IntermediaryRow[]>();
  let rows = data ?? [];
  const appIds = rows.map((row) => row.application_id).filter((value): value is string => Boolean(value));
  const { data: apps } = appIds.length ? await admin.from("intermediary_onboarding_applications").select("id,registration_status,partner_status,requested_type,final_type,draft_data").in("id", appIds).returns<ApplicationState[]>() : { data: [] as ApplicationState[] };
  const applicationMap = new Map((apps ?? []).map((item) => [item.id, item]));

  if (effectiveType === "partner") rows = rows.filter((row) => accountContext(applicationMap.get(row.application_id ?? "")) === "partner");
  if (selectedType === "posp" || selectedType === "misp") rows = rows.filter((row) => applicationMap.get(row.application_id ?? "")?.registration_status === REGISTERED_STATUS);
  if (registrationStatus) rows = rows.filter((row) => applicationMap.get(row.application_id ?? "")?.registration_status === registrationStatus);

  let countRequest = admin.from("intermediaries").select("id,intermediary_type,application_id");
  if (accessibleIds !== null) countRequest = accessibleIds.length ? countRequest.in("id", accessibleIds) : countRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
  const { data: allCounts } = await countRequest.returns<Array<{ id: string; intermediary_type: IntermediaryType; application_id: string | null }>>();
  const countAppIds = (allCounts ?? []).map((row) => row.application_id).filter((value): value is string => Boolean(value));
  const { data: countApps } = countAppIds.length ? await admin.from("intermediary_onboarding_applications").select("id,registration_status,partner_status,requested_type,final_type,draft_data").in("id", countAppIds).returns<ApplicationState[]>() : { data: [] as ApplicationState[] };
  const countStatusMap = new Map((countApps ?? []).map((item) => [item.id, item]));
  const count = (type: IntermediaryType) => (allCounts ?? []).filter((row) => type === "partner" ? accountContext(countStatusMap.get(row.application_id ?? "")) === "partner" : row.intermediary_type === type && countStatusMap.get(row.application_id ?? "")?.registration_status === REGISTERED_STATUS).length;

  const pageTitle = selectedType === "posp" ? "POSP" : selectedType === "misp" ? "MISP" : selectedType === "partner" ? "Partners" : "Overview";
  const searchAction = selectedType ? `/intermediaries/${selectedType}` : "/intermediaries";
  const onboardingAction = selectedType === "posp" ? { href: "/customers/posp-misp/new?partner_type=posp", label: "Onboard POSP" } : selectedType === "misp" ? { href: "/customers/posp-misp/new?partner_type=misp", label: "Onboard MISP" } : null;
  const successMessage = success === "portal_login_invited" ? "Password creation link sent." : success === "portal_invite_resent" ? "A fresh password creation link has been sent." : success === "documents_completed" ? "Documents saved and Partner activated." : "Action completed.";
  const activeMetric = typeFilter;

  return <AppShell title={pageTitle}><div className="mx-auto max-w-[1480px] space-y-4 pb-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><form method="get" action={searchAction} className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" /><input name="q" defaultValue={search} placeholder="Search name, mobile, email or ID" className="h-11 w-full rounded-xl border border-[#D8E1EC] bg-white/70 pl-10 pr-4 text-[11px] text-[#17203A] shadow-sm outline-none backdrop-blur placeholder:text-[#94A3B8] focus:border-[#9AA9FF] focus:ring-2 focus:ring-[#E4E8FF]" /></form>{canCreate && onboardingAction ? <Link href={onboardingAction.href} className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-[#C9D5E5] bg-white/75 px-4 text-[10.5px] font-bold text-[#0F2A55] shadow-sm backdrop-blur transition hover:border-[#9AA9FF] hover:bg-white">{onboardingAction.label}</Link> : null}</div>{!selectedType ? <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white/75 shadow-sm backdrop-blur"><div className="grid gap-px bg-[#E2E8F0] sm:grid-cols-3"><MetricFilter label="POSP" value={count("posp")} href={metricHref("posp", search, activeMetric)} active={activeMetric === "posp"} /><MetricFilter label="MISP" value={count("misp")} href={metricHref("misp", search, activeMetric)} active={activeMetric === "misp"} /><MetricFilter label="Partners" value={count("partner")} href={metricHref("partner", search, activeMetric)} active={activeMetric === "partner"} /></div></section> : null}{success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10.5px] font-medium text-emerald-700">{successMessage}</div> : null}{error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-medium text-red-700">{decodeURIComponent(error)}</div> : null}<section className="overflow-hidden rounded-2xl border bg-white/80 shadow-sm backdrop-blur"><div className="border-b bg-white/60 px-4 py-3"><h2 className="text-[12px] font-semibold">Intermediary register</h2></div>{loadError ? <div className="px-4 py-12 text-center text-[11px] text-red-700">The register could not be loaded.</div> : rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-[10.5px]"><thead className="border-b text-[8.5px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">Account</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Account ID</th><th className="px-3 py-3">Parent Partner</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Workflow</th><th className="px-3 py-3">Portal / Access</th></tr></thead><tbody className="divide-y">{rows.map((row) => { const app = applicationMap.get(row.application_id ?? ""); const context = accountContext(app); const lifecycle = deriveLifecycle(app, context); const isPartnerAccount = context === "partner"; const canCreateLogin = canReview && isPartnerAccount && app?.partner_status === "active_partner" && row.portal_access_status === "not_created"; const canResend = canReview && isPartnerAccount && app?.partner_status === "active_partner" && row.portal_access_status === "invited"; return <tr key={row.id} className="hover:bg-[#FAFCFF]"><td className="px-4 py-3"><p className="font-semibold text-[#0F2A55]">{accountLabel(context, app)}</p><p className="mt-0.5 text-[8.5px] font-medium text-[#64748B]">{isPartnerAccount ? "Parent account" : "Linked account"}</p></td><td className="px-3 py-3">{row.application_id ? <Link href={`/intermediaries/applications/${row.application_id}`} className="font-semibold text-[#0F2A55] hover:text-[#635BFF] hover:underline">{row.display_name}</Link> : <p className="font-semibold">{row.display_name}</p>}<p className="mt-0.5 text-[8.5px] text-[#64748B]">{row.city ?? "-"}</p></td><td className="px-3 py-3 font-semibold text-[#0F2A55]">{displayIdentity(row, app, selectedType)}</td><td className="px-3 py-3 text-[#17203A]">{parentPartnerId(row, app)}</td><td className="px-3 py-3"><p>{row.mobile ?? "-"}</p><p className="text-[8.5px] text-[#64748B]">{row.email ?? "-"}</p></td><td className="px-3 py-3"><Status value={lifecycle.stage} /><p className="mt-1 text-[8.5px] text-[#64748B]">{lifecycle.account}</p></td><td className="px-3 py-3">{canCreateLogin ? <form action={createIntermediaryPortalLogin}><input type="hidden" name="intermediary_id" value={row.id} /><input type="hidden" name="return_path" value={searchAction} /><FormSubmitButton label="Create user" pendingLabel="Sending link" className="rounded-lg bg-[#0F2A55] px-3 py-1.5 text-[9px] font-semibold text-white disabled:opacity-60" /></form> : canResend ? <form action={resendIntermediaryPortalInvite}><input type="hidden" name="intermediary_id" value={row.id} /><input type="hidden" name="return_path" value={searchAction} /><FormSubmitButton label="Resend link" pendingLabel="Sending again" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[9px] font-semibold text-amber-800 disabled:opacity-60" /></form> : <><Status value={isPartnerAccount ? row.portal_access_status : "Managed from partner"} /><p className="mt-1 text-[8.5px] text-[#94A3B8]">{isPartnerAccount ? "Partner login" : "No separate user"}</p></>}</td></tr>; })}</tbody></table></div> : <div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold">No records found</p></div>}</section></div></AppShell>;
}

function accountContext(app: ApplicationState | undefined): IntermediaryType {
  const context = app?.draft_data?.account_context;
  return context === "posp" || context === "misp" ? context : "partner";
}

function accountLabel(context: IntermediaryType, app: ApplicationState | undefined) {
  if (context === "partner") return app?.partner_status === "active_partner" ? "Partner" : "Partner onboarding";
  return `${context.toUpperCase()} onboarding`;
}

function deriveLifecycle(app: ApplicationState | undefined, context = accountContext(app)) {
  const status = app?.registration_status ?? "";
  if (context === "partner") {
    if (app?.partner_status === "active_partner") return { stage: "Active Partner", account: "Active Partner" };
    if (status === "documents_pending") return { stage: "Documents Pending", account: "Partner Onboarding" };
    return { stage: "Pending Partner", account: "Partner Onboarding" };
  }
  if (status === REGISTERED_STATUS) return { stage: `Active ${context.toUpperCase()}`, account: `Active ${context.toUpperCase()}` };
  if (status.includes("iib") || status.includes("upload")) return { stage: "IIB Upload Pending", account: "Under Onboarding" };
  if (status.includes("agreement") && status.includes("complete")) return { stage: "IIB Upload Pending", account: "Under Onboarding" };
  if (status.includes("agreement")) return { stage: "Agreement Pending", account: "Under Onboarding" };
  if (status.includes("exam") && status.includes("pass")) return { stage: "Agreement Pending", account: "Under Onboarding" };
  if (status.includes("training") && status.includes("complete")) return { stage: "Training Completed", account: "Under Onboarding" };
  if (status.includes("training") || status.includes("exam")) return { stage: "Training Started", account: "Under Onboarding" };
  return { stage: `${context.toUpperCase()} Onboarding Pending`, account: "Under Onboarding" };
}

function permanentCodes(row: IntermediaryRow) {
  return [row.intermediary_code?.trim(), row.onboarding_id?.trim()].filter((value): value is string => Boolean(value) && !value!.startsWith("PENDING-"));
}

function displayIdentity(row: IntermediaryRow, app: ApplicationState | undefined, selectedType: IntermediaryType | null) {
  const context = selectedType ?? accountContext(app);
  const codes = permanentCodes(row);
  const partnerId = codes.find((code) => code.startsWith("PART-"));
  const intermediaryId = codes.find((code) => !code.startsWith("PART-"));
  if (context === "partner") return partnerId ?? "Partner ID pending";
  if (app?.registration_status === REGISTERED_STATUS) return intermediaryId ?? `${context.toUpperCase()} ID pending`;
  return `${context.toUpperCase()} ID pending`;
}

function parentPartnerId(row: IntermediaryRow, app: ApplicationState | undefined) {
  const context = accountContext(app);
  const codes = permanentCodes(row);
  const partnerId = codes.find((code) => code.startsWith("PART-"));
  const linkedCode = typeof app?.draft_data?.linked_partner_code === "string" ? app.draft_data.linked_partner_code : null;
  if (context === "partner") return "Self";
  return linkedCode ?? partnerId ?? "Partner ID pending";
}

function MetricFilter({ label, value, href, active }: { label: string; value: number; href: string; active: boolean }) {
  return <Link href={href} className={`bg-white/90 px-4 py-3 ${active ? "bg-[#EEF2FF]" : ""}`}><p className="text-[9px] uppercase text-[#64748B]">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></Link>;
}

function metricHref(metric: IntermediaryType, search: string, activeMetric: IntermediaryType | null) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (activeMetric !== metric) params.set("type", metric);
  const query = params.toString();
  return `/intermediaries${query ? `?${query}` : ""}`;
}

function Status({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[8.5px] font-semibold capitalize text-slate-700">{value.replaceAll("_", " ")}</span>;
}
