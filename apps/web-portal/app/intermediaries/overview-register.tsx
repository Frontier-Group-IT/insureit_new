import { Search } from "lucide-react";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getAccessibleIntermediaryIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { hasCapability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { FreshAccountReviewLink } from "./applications/account-review-back-link";
import { createLinkedIntermediaryAccount } from "./applications/[id]/account-review-actions";

type AccountType = "posp" | "misp";
type IntermediaryRow = {
  id: string;
  intermediary_code: string | null;
  onboarding_id: string | null;
  intermediary_type: "posp" | "misp" | "partner";
  requested_type: AccountType;
  display_name: string;
  city: string | null;
  portal_access_status: string;
  account_status: string;
  application_id: string | null;
  updated_at: string;
};
type ApplicationState = {
  id: string;
  registration_status: string;
  partner_status: string | null;
  requested_type: AccountType;
  draft_data: Record<string, unknown> | null;
  partner_record_id: string | null;
};

const APPLICATION_SELECT = "id,registration_status,partner_status,requested_type,draft_data,partner_record_id";

export async function OverviewIntermediaryRegister({ search = "", success, error }: { search?: string; success?: string; error?: string }) {
  const profile = await requirePospMispManager();
  const admin = createSupabaseAdminClient();
  const accessibleIds = await getAccessibleIntermediaryIds(profile!.id, profile!.role);
  const canReview = hasCapability(profile!.role, "review_intermediary_application");

  let request = admin.from("intermediaries").select("id,intermediary_code,onboarding_id,intermediary_type,requested_type,display_name,city,portal_access_status,account_status,application_id,updated_at").order("updated_at", { ascending: false }).limit(500);
  if (accessibleIds !== null) request = accessibleIds.length ? request.in("id", accessibleIds) : request.in("id", ["00000000-0000-0000-0000-000000000000"]);
  const { data, error: loadError } = await request.returns<IntermediaryRow[]>();
  const allRows = data ?? [];

  const appIds = allRows.map((row) => row.application_id).filter((value): value is string => Boolean(value));
  const { data: apps } = appIds.length
    ? await admin.from("intermediary_onboarding_applications").select(APPLICATION_SELECT).in("id", appIds).returns<ApplicationState[]>()
    : { data: [] as ApplicationState[] };
  const appMap = new Map((apps ?? []).map((app) => [app.id, app]));
  const intermediaryByApplication = new Map(allRows.filter((row) => row.application_id).map((row) => [row.application_id as string, row]));
  const partnerRows = allRows.filter((row) => accountContext(appMap.get(row.application_id ?? "")) === "partner");
  const partnerRecordIds = [...new Set(partnerRows.map((row) => appMap.get(row.application_id ?? "")?.partner_record_id).filter((value): value is string => Boolean(value)))];
  const { data: relatedApps } = partnerRecordIds.length
    ? await admin.from("intermediary_onboarding_applications").select(APPLICATION_SELECT).in("partner_record_id", partnerRecordIds).returns<ApplicationState[]>()
    : { data: [] as ApplicationState[] };
  const linkedMap = new Map<string, ApplicationState>();
  for (const app of relatedApps ?? []) {
    if (!app.partner_record_id || accountContext(app) === "partner") continue;
    linkedMap.set(app.partner_record_id, app);
  }

  const normalized = search.trim().toLowerCase();
  const visible = partnerRows.filter((row) => {
    if (!normalized) return true;
    const app = appMap.get(row.application_id ?? "");
    return [row.display_name, row.intermediary_code, row.onboarding_id, row.city, textValue(app?.draft_data?.state), textValue(app?.draft_data?.associate_name)].some((value) => value?.toLowerCase().includes(normalized));
  });
  const linkedApps = [...linkedMap.values()];
  const pospCount = linkedApps.filter((app) => accountContext(app) === "posp").length;
  const mispCount = linkedApps.filter((app) => accountContext(app) === "misp").length;

  return <AppShell title="Overview"><div className="mx-auto max-w-[1480px] space-y-4 pb-6">
    <form method="get" action="/intermediaries" className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"/><input name="q" defaultValue={search} placeholder="Search Partner name, Partner ID, location or RM" className="h-12 w-full rounded-2xl border border-[#D8E1EC] bg-white/80 pl-11 pr-4 text-[11px] shadow-sm outline-none focus:border-[#9AA9FF] focus:ring-2 focus:ring-[#E4E8FF]"/></form>
    <section className="grid overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm sm:grid-cols-3"><Metric label="POSP accounts" value={pospCount}/><Metric label="MISP accounts" value={mispCount}/><Metric label="Total Partners" value={partnerRows.length}/></section>
    {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10.5px] font-medium text-emerald-700">Action completed successfully.</div> : null}
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-medium text-red-700">{decodeURIComponent(error)}</div> : null}
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm"><div className="border-b bg-[#FAFBFD] px-5 py-4"><h2 className="text-[12.5px] font-semibold">Partner onboarding overview</h2><p className="mt-1 text-[9px] text-[#64748B]">One Partner per row with its linked POSP or MISP account.</p></div>
      {loadError ? <div className="px-5 py-14 text-center text-[11px] text-red-700">The overview could not be loaded.</div> : visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1260px] text-left text-[10.5px]"><thead className="border-b bg-[#FAFBFD] text-[8.5px] uppercase text-[#64748B]"><tr><th className="px-5 py-3.5">Partner</th><th className="px-3 py-3.5">Partner ID</th><th className="px-3 py-3.5">Type</th><th className="px-3 py-3.5">Linked account</th><th className="px-3 py-3.5">Onboarding stage</th><th className="px-3 py-3.5">Assigned RM</th><th className="px-3 py-3.5">Portal access</th><th className="px-3 py-3.5">Action</th></tr></thead><tbody className="divide-y">{visible.map((row) => {
        const partnerApp = appMap.get(row.application_id ?? "");
        const linkedApp = partnerApp?.partner_record_id ? linkedMap.get(partnerApp.partner_record_id) : undefined;
        const linkedType: AccountType = linkedApp ? linkedAccountType(linkedApp) : (partnerApp?.requested_type ?? row.requested_type);
        const linkedRow = linkedApp ? intermediaryByApplication.get(linkedApp.id) : undefined;
        const partnerId = permanentCode(row, "PART-") ?? "Partner ID pending";
        const linkedId = linkedRow ? permanentAccountCode(linkedRow, linkedType) : null;
        const rm = textValue(partnerApp?.draft_data?.associate_name) ?? "Not assigned";
        const activePartner = partnerApp?.partner_status === "active_partner" || row.account_status === "active";
        return <tr key={row.id} className="hover:bg-[#F8FAFF]"><td className="px-5 py-4"><p className="font-semibold text-[#0F2A55]">{row.display_name}</p><p className="mt-1 text-[8.5px] text-[#64748B]">{partnerLocation(row, partnerApp)}</p></td><td className="px-3 py-4 font-semibold text-[#0F2A55]">{partnerId}</td><td className="px-3 py-4"><Badge value={linkedType === "misp" ? "Business" : "Individual"}/></td><td className="px-3 py-4"><p className="font-semibold text-[#0F2A55]">{linkedType.toUpperCase()}</p><p className="mt-1 text-[8.5px] text-[#64748B]">{linkedApp ? linkedId ?? "ID pending" : "Not created"}</p></td><td className="px-3 py-4"><Badge value={linkedApp ? stageFor(linkedApp, linkedType) : "Not started"}/></td><td className="px-3 py-4">{rm}</td><td className="px-3 py-4"><Badge value={portalLabel(row.portal_access_status)}/></td><td className="px-3 py-4">{linkedApp ? <FreshAccountReviewLink href={`/intermediaries/applications/${linkedApp.id}`} className="inline-flex rounded-lg bg-[#0F2A55] px-3 py-2 text-[9px] font-semibold text-white">View linked {linkedType.toUpperCase()}</FreshAccountReviewLink> : canReview && row.application_id && activePartner ? <form action={createLinkedIntermediaryAccount}><input type="hidden" name="application_id" value={row.application_id}/><input type="hidden" name="registration_type" value={linkedType}/><FormSubmitButton label={`Create ${linkedType.toUpperCase()}`} pendingLabel="Creating" className="rounded-lg bg-[#635BFF] px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-60"/></form> : <span className="text-[#94A3B8]">—</span>}</td></tr>;
      })}</tbody></table></div> : <div className="px-5 py-16 text-center"><p className="text-[12px] font-semibold">No Partners found</p></div>}
    </section>
  </div></AppShell>;
}

function accountContext(app: ApplicationState | undefined): "partner" | AccountType { const value = app?.draft_data?.account_context; return value === "posp" || value === "misp" ? value : "partner"; }
function linkedAccountType(app: ApplicationState): AccountType { const value = accountContext(app); return value === "partner" ? app.requested_type : value; }
function permanentCodes(row: IntermediaryRow) { return [row.intermediary_code, row.onboarding_id].map((value) => value?.trim()).filter((value): value is string => Boolean(value) && !value!.startsWith("PENDING-")); }
function permanentCode(row: IntermediaryRow, prefix: string) { return permanentCodes(row).find((code) => code.startsWith(prefix)) ?? null; }
function permanentAccountCode(row: IntermediaryRow, type: AccountType) { return permanentCodes(row).find((code) => code.startsWith(`${type.toUpperCase()}-`)) ?? null; }
function partnerLocation(row: IntermediaryRow, app: ApplicationState | undefined) { const city = textValue(app?.draft_data?.city) ?? row.city; const state = textValue(app?.draft_data?.state); return [city, state].filter(Boolean).join(", ") || "Location not available"; }
function stageFor(app: ApplicationState, type: AccountType) { const status = app.registration_status?.toLowerCase() ?? ""; if (status === "iib_registered") return "Active"; if (status.includes("iib")) return "IIB pending"; if (status.includes("agreement")) return status.includes("sign") ? "Agreement signed" : "Agreement pending"; if (type === "misp") return "Agreement pending"; if (status.includes("exam")) return status.includes("pass") ? "Exam passed" : "Exam pending"; if (status.includes("training")) return status.includes("complete") ? "Training completed" : "Training started"; return "Onboarding started"; }
function portalLabel(status: string) { if (status === "active") return "Active"; if (status === "invited") return "Invitation sent"; if (status === "disabled" || status === "suspended") return "Disabled"; return "Not created"; }
function textValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="border-r border-[#E2E8F0] px-5 py-4 last:border-r-0"><p className="text-[8.5px] uppercase text-[#64748B]">{label}</p><p className="mt-1 text-[22px] font-semibold text-[#0F2A55]">{value}</p></div>; }
function Badge({ value }: { value: string }) { return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[8.5px] font-semibold text-slate-700">{value}</span>; }
