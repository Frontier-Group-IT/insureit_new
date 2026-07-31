import { Search } from "lucide-react";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getAccessibleIntermediaryIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { hasCapability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { FreshAccountReviewLink } from "./applications/account-review-back-link";
import { createLinkedIntermediaryAccount } from "./applications/[id]/account-review-actions";

type IntermediaryRow = {
  id: string;
  intermediary_code: string | null;
  onboarding_id: string | null;
  intermediary_type: "posp" | "misp" | "partner";
  requested_type: "posp" | "misp";
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
  requested_type: "posp" | "misp";
  draft_data: Record<string, unknown> | null;
  partner_record_id: string | null;
};

const APPLICATION_SELECT = "id,registration_status,partner_status,requested_type,draft_data,partner_record_id";
const REGISTERED_STATUS = "iib_registered";

export async function OverviewIntermediaryRegister({ search = "", success, error }: { search?: string; success?: string; error?: string }) {
  const profile = await requirePospMispManager();
  const admin = createSupabaseAdminClient();
  const accessibleIds = await getAccessibleIntermediaryIds(profile!.id, profile!.role);
  const canReview = hasCapability(profile!.role, "review_intermediary_application");

  let intermediaryRequest = admin
    .from("intermediaries")
    .select("id,intermediary_code,onboarding_id,intermediary_type,requested_type,display_name,city,portal_access_status,account_status,application_id,updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (accessibleIds !== null) {
    intermediaryRequest = accessibleIds.length
      ? intermediaryRequest.in("id", accessibleIds)
      : intermediaryRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: intermediaryData, error: loadError } = await intermediaryRequest.returns<IntermediaryRow[]>();
  const allRows = intermediaryData ?? [];
  const applicationIds = allRows.map((row) => row.application_id).filter((value): value is string => Boolean(value));
  const { data: applications } = applicationIds.length
    ? await admin.from("intermediary_onboarding_applications").select(APPLICATION_SELECT).in("id", applicationIds).returns<ApplicationState[]>()
    : { data: [] as ApplicationState[] };

  const applicationMap = new Map((applications ?? []).map((application) => [application.id, application]));
  const intermediaryByApplication = new Map(allRows.filter((row) => row.application_id).map((row) => [row.application_id as string, row]));
  const partnerRows = allRows.filter((row) => accountContext(applicationMap.get(row.application_id ?? "")) === "partner");
  const partnerRecordIds = partnerRows
    .map((row) => applicationMap.get(row.application_id ?? "")?.partner_record_id)
    .filter((value): value is string => Boolean(value));

  const { data: relatedApplications } = partnerRecordIds.length
    ? await admin
        .from("intermediary_onboarding_applications")
        .select(APPLICATION_SELECT)
        .in("partner_record_id", [...new Set(partnerRecordIds)])
        .returns<ApplicationState[]>()
    : { data: [] as ApplicationState[] };

  const linkedByPartnerRecord = new Map<string, ApplicationState>();
  for (const related of relatedApplications ?? []) {
    if (!related.partner_record_id || accountContext(related) === "partner") continue;
    const current = linkedByPartnerRecord.get(related.partner_record_id);
    if (!current || linkedPriority(related.registration_status) > linkedPriority(current.registration_status)) {
      linkedByPartnerRecord.set(related.partner_record_id, related);
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const visiblePartners = partnerRows.filter((row) => {
    if (!normalizedSearch) return true;
    const app = applicationMap.get(row.application_id ?? "");
    const values = [
      row.display_name,
      row.intermediary_code,
      row.onboarding_id,
      row.city,
      textValue(app?.draft_data?.state),
      textValue(app?.draft_data?.associate_name),
    ];
    return values.some((value) => value?.toLowerCase().includes(normalizedSearch));
  });

  const linkedApplications = [...linkedByPartnerRecord.values()];
  const pospCount = linkedApplications.filter((application) => accountContext(application) === "posp").length;
  const mispCount = linkedApplications.filter((application) => accountContext(application) === "misp").length;
  const successMessage = success === "linked_posp_account_created"
    ? "POSP account created successfully."
    : success === "linked_misp_account_created"
      ? "MISP account created successfully."
      : "Action completed.";

  return (
    <AppShell title="Overview">
      <div className="mx-auto max-w-[1480px] space-y-4 pb-6">
        <form method="get" action="/intermediaries" className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Search Partner name, Partner ID, location or RM"
            className="h-12 w-full rounded-2xl border border-[#D8E1EC] bg-white/80 pl-11 pr-4 text-[11px] text-[#17203A] shadow-sm outline-none backdrop-blur placeholder:text-[#94A3B8] focus:border-[#9AA9FF] focus:ring-2 focus:ring-[#E4E8FF]"
          />
        </form>

        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white/80 shadow-sm backdrop-blur">
          <div className="grid gap-px bg-[#E2E8F0] sm:grid-cols-3">
            <Metric label="POSP accounts" value={pospCount} />
            <Metric label="MISP accounts" value={mispCount} />
            <Metric label="Total Partners" value={partnerRows.length} />
          </div>
        </section>

        {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10.5px] font-medium text-emerald-700">{successMessage}</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-medium text-red-700">{decodeURIComponent(error)}</div> : null}

        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white/85 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b bg-white/65 px-5 py-4">
            <div>
              <h2 className="text-[12.5px] font-semibold text-[#17203A]">Partner onboarding overview</h2>
              <p className="mt-1 text-[9px] text-[#64748B]">One row per Partner with the linked POSP or MISP journey.</p>
            </div>
            <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[9px] font-semibold text-[#4338CA]">{visiblePartners.length} Partners</span>
          </div>

          {loadError ? (
            <div className="px-4 py-14 text-center text-[11px] text-red-700">The overview could not be loaded.</div>
          ) : visiblePartners.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1260px] text-left text-[10.5px]">
                <thead className="border-b bg-[#FAFBFD] text-[8.5px] uppercase tracking-[0.03em] text-[#64748B]">
                  <tr>
                    <th className="px-5 py-3.5">Partner</th>
                    <th className="px-3 py-3.5">Partner ID</th>
                    <th className="px-3 py-3.5">Type</th>
                    <th className="px-3 py-3.5">Linked account</th>
                    <th className="px-3 py-3.5">Onboarding stage</th>
                    <th className="px-3 py-3.5">Assigned RM</th>
                    <th className="px-3 py-3.5">Portal access</th>
                    <th className="px-3 py-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7ECF3]">
                  {visiblePartners.map((row) => {
                    const partnerApplication = applicationMap.get(row.application_id ?? "");
                    const linkedApplication = partnerApplication?.partner_record_id ? linkedByPartnerRecord.get(partnerApplication.partner_record_id) : undefined;
                    const linkedType = linkedApplication ? accountContext(linkedApplication) : partnerApplication?.requested_type ?? row.requested_type;
                    const linkedIntermediary = linkedApplication ? intermediaryByApplication.get(linkedApplication.id) : undefined;
                    const partnerId = permanentCode(row, "PART-") ?? "Partner ID pending";
                    const linkedId = linkedIntermediary ? permanentLinkedCode(linkedIntermediary, linkedType) : null;
                    const location = partnerLocation(row, partnerApplication);
                    const assignedRm = textValue(partnerApplication?.draft_data?.associate_name) ?? "Not assigned";
                    const activePartner = partnerApplication?.partner_status === "active_partner" || row.account_status === "active";

                    return (
                      <tr key={row.id} className="transition hover:bg-[#F8FAFF]">
                        <td className="px-5 py-4">
                          {row.application_id ? (
                            <FreshAccountReviewLink href={`/intermediaries/applications/${row.application_id}`} className="font-semibold text-[#0F2A55] hover:text-[#635BFF] hover:underline">
                              {row.display_name}
                            </FreshAccountReviewLink>
                          ) : <p className="font-semibold text-[#0F2A55]">{row.display_name}</p>}
                          <p className="mt-1 text-[8.5px] text-[#64748B]">{location}</p>
                        </td>
                        <td className="px-3 py-4 font-semibold text-[#0F2A55]">{partnerId}</td>
                        <td className="px-3 py-4"><PlainBadge value={linkedType === "misp" ? "Business" : "Individual"} /></td>
                        <td className="px-3 py-4">
                          {linkedApplication ? (
                            <div>
                              <p className="font-semibold text-[#0F2A55]">{linkedType.toUpperCase()}</p>
                              <p className="mt-1 text-[8.5px] text-[#64748B]">{linkedId ?? "ID pending"}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-[#475569]">{linkedType.toUpperCase()} not created</p>
                              <p className="mt-1 text-[8.5px] text-[#94A3B8]">No linked application</p>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-4"><StageBadge value={linkedApplication ? onboardingStage(linkedApplication, linkedType) : "Not started"} /></td>
                        <td className="px-3 py-4">
                          <p className={assignedRm === "Not assigned" ? "text-amber-700" : "font-medium text-[#17203A]"}>{assignedRm}</p>
                        </td>
                        <td className="px-3 py-4"><PortalBadge value={portalAccessLabel(row.portal_access_status)} /></td>
                        <td className="px-3 py-4">
                          {linkedApplication ? (
                            <FreshAccountReviewLink href={`/intermediaries/applications/${linkedApplication.id}`} className="inline-flex rounded-lg bg-[#0F2A55] px-3 py-2 text-[9px] font-semibold text-white transition hover:bg-[#173A70]">
                              View linked {linkedType.toUpperCase()}
                            </FreshAccountReviewLink>
                          ) : canReview && row.application_id && activePartner ? (
                            <form action={createLinkedIntermediaryAccount}>
                              <input type="hidden" name="application_id" value={row.application_id} />
                              <input type="hidden" name="registration_type" value={linkedType} />
                              <FormSubmitButton label={`Create ${linkedType.toUpperCase()}`} pendingLabel="Creating" className="rounded-lg bg-[#635BFF] px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-60" />
                            </form>
                          ) : <span className="text-[#94A3B8]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-16 text-center">
              <p className="text-[12px] font-semibold text-[#17203A]">No Partners found</p>
              <p className="mt-1 text-[9.5px] text-[#64748B]">Try a different search term.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function accountContext(application: ApplicationState | undefined): "partner" | "posp" | "misp" {
  const context = application?.draft_data?.account_context;
  return context === "posp" || context === "misp" ? context : "partner";
}

function linkedPriority(status: string) {
  if (status === REGISTERED_STATUS) return 3;
  if (status) return 2;
  return 1;
}

function permanentCodes(row: IntermediaryRow) {
  return [row.intermediary_code?.trim(), row.onboarding_id?.trim()].filter((value): value is string => Boolean(value) && !value!.startsWith("PENDING-"));
}

function permanentCode(row: IntermediaryRow, prefix: string) {
  return permanentCodes(row).find((code) => code.startsWith(prefix)) ?? null;
}

function permanentLinkedCode(row: IntermediaryRow, type: "posp" | "misp") {
  return permanentCodes(row).find((code) => code.startsWith(`${type.toUpperCase()}-`) || !code.startsWith("PART-")) ?? null;
}

function partnerLocation(row: IntermediaryRow, application: ApplicationState | undefined) {
  const city = textValue(application?.draft_data?.city) ?? row.city;
  const state = textValue(application?.draft_data?.state);
  return [city, state].filter(Boolean).join(", ") || "Location not available";
}

function onboardingStage(application: ApplicationState, type: "posp" | "misp") {
  const status = application.registration_status?.toLowerCase() ?? "";
  if (status === REGISTERED_STATUS) return "Active";
  if (status.includes("iib")) return "IIB pending";
  if (status.includes("agreement") && status.includes("sign")) return "Agreement signed";
  if (status.includes("agreement")) return "Agreement pending";
  if (type === "misp") return "Agreement pending";
  if (status.includes("exam") && status.includes("pass")) return "Exam passed";
  if (status.includes("exam")) return "Exam pending";
  if (status.includes("training") && status.includes("complete")) return "Training completed";
  if (status.includes("training") && (status.includes("start") || status.includes("assign"))) return "Training started";
  if (status.includes("training")) return "Training pending";
  return "Onboarding started";
}

function portalAccessLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "invited") return "Invitation sent";
  if (status === "disabled" || status === "suspended") return "Disabled";
  return "Not created";
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="bg-white/90 px-5 py-4"><p className="text-[9px] uppercase tracking-[0.04em] text-[#64748B]">{label}</p><p className="mt-1 text-[22px] font-semibold text-[#071D49]">{value}</p></div>;
}

function PlainBadge({ value }: { value: string }) {
  return <span className="inline-flex rounded-full border border-[#DCE5EF] bg-[#F8FAFC] px-2.5 py-1 text-[8.5px] font-semibold text-[#475569]">{value}</span>;
}

function StageBadge({ value }: { value: string }) {
  const active = value === "Active";
  const pending = value === "Not started" || value.includes("pending");
  const className = active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : pending
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-indigo-200 bg-indigo-50 text-indigo-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[8.5px] font-semibold ${className}`}>{value}</span>;
}

function PortalBadge({ value }: { value: string }) {
  const className = value === "Active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : value === "Invitation sent"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : value === "Disabled"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[8.5px] font-semibold ${className}`}>{value}</span>;
}
