import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "@/components/shell";
import { getAccessibleIntermediaryIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { FreshAccountReviewLink } from "./applications/account-review-back-link";

type AccountType = "posp" | "misp";
type IntermediaryRow = {
  id: string;
  intermediary_code: string | null;
  onboarding_id: string | null;
  display_name: string;
  mobile: string | null;
  email: string | null;
  city: string | null;
  account_status: string;
  application_id: string | null;
  updated_at: string;
};
type ApplicationRow = {
  id: string;
  registration_status: string;
  draft_data: Record<string, unknown> | null;
  partner_record_id: string | null;
  registration_record_id: string | null;
};
type PartnerRow = { id: string; partner_code: string };
type ProfileRow = { application_id: string; external_onboarding_id: string | null; existing_registration_code: string | null };
type RegistrationRow = { id: string; registration_code: string | null };

const APP_SELECT = "id,registration_status,draft_data,partner_record_id,registration_record_id";

export async function StructuredAccountRegister({ type, search = "" }: { type: AccountType; search?: string }) {
  const profile = await requirePospMispManager();
  const admin = createSupabaseAdminClient();
  const accessibleIds = await getAccessibleIntermediaryIds(profile!.id, profile!.role);

  let request = admin
    .from("intermediaries")
    .select("id,intermediary_code,onboarding_id,display_name,mobile,email,city,account_status,application_id,updated_at")
    .eq("intermediary_type", type)
    .order("updated_at", { ascending: false })
    .limit(250);
  if (accessibleIds !== null) request = accessibleIds.length ? request.in("id", accessibleIds) : request.in("id", ["00000000-0000-0000-0000-000000000000"]);
  if (search) request = request.or(`display_name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%,intermediary_code.ilike.%${search}%,onboarding_id.ilike.%${search}%`);

  const { data, error } = await request.returns<IntermediaryRow[]>();
  const rows = data ?? [];
  const appIds = rows.map((row) => row.application_id).filter((value): value is string => Boolean(value));
  const [{ data: applications }, { data: accountProfiles }] = appIds.length
    ? await Promise.all([
        admin.from("intermediary_onboarding_applications").select(APP_SELECT).in("id", appIds).returns<ApplicationRow[]>(),
        admin.from("posp_misp_onboarding_profiles").select("application_id,external_onboarding_id,existing_registration_code").in("application_id", appIds).returns<ProfileRow[]>(),
      ])
    : [{ data: [] as ApplicationRow[] }, { data: [] as ProfileRow[] }];
  const appMap = new Map((applications ?? []).map((app) => [app.id, app]));
  const profileMap = new Map((accountProfiles ?? []).map((item) => [item.application_id, item]));
  const partnerIds = [...new Set((applications ?? []).map((app) => app.partner_record_id).filter((value): value is string => Boolean(value)))];
  const registrationIds = [...new Set((applications ?? []).map((app) => app.registration_record_id).filter((value): value is string => Boolean(value)))];
  const [{ data: partners }, { data: registrations }] = await Promise.all([
    partnerIds.length
      ? admin.from("partners").select("id,partner_code").in("id", partnerIds).returns<PartnerRow[]>()
      : Promise.resolve({ data: [] as PartnerRow[] }),
    registrationIds.length
      ? admin.from("intermediary_registrations").select("id,registration_code").in("id", registrationIds).returns<RegistrationRow[]>()
      : Promise.resolve({ data: [] as RegistrationRow[] }),
  ]);
  const partnerMap = new Map((partners ?? []).map((partner) => [partner.id, partner.partner_code]));
  const registrationMap = new Map((registrations ?? []).map((registration) => [registration.id, registration.registration_code]));

  const counts = rows.reduce((acc, row) => {
    const stage = stageFor(appMap.get(row.application_id ?? ""));
    if (stage === "Active") acc.active += 1;
    else acc.onboarding += 1;
    return acc;
  }, { active: 0, onboarding: 0 });

  const title = type.toUpperCase();
  const onboardHref = `/customers/posp-misp/new?partner_type=${type}`;
  return (
    <AppShell title={`${title} Register`}>
      <div className="mx-auto max-w-[1480px] space-y-4 pb-6">
        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <div className="grid items-center gap-3 border-b border-[#E7ECF3] bg-[#FAFBFD] px-4 py-2.5 lg:grid-cols-[auto_minmax(260px,1fr)_auto_auto]">
            <h2 className="whitespace-nowrap text-[12px] font-semibold text-[#17203A]">{title} Register</h2>
            <form method="get" className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <input name="q" defaultValue={search} placeholder={`Search ${title} name, ID, Partner ID, mobile or email`} className="h-8 w-full rounded-lg border border-[#D8E1EC] bg-white pl-9 pr-3 text-[10px] text-[#17203A] outline-none placeholder:text-[#94A3B8] focus:border-[#315FEA] focus:ring-2 focus:ring-[#E6ECFF]" />
            </form>
            <Link href={onboardHref} className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#0F2A55] px-3.5 text-[9.5px] font-semibold text-white transition hover:bg-[#173A70]">Onboard {title}</Link>
            <div className="flex items-center justify-end gap-3 whitespace-nowrap text-[9.5px] font-medium text-[#64748B]">
              <span>All <strong className="ml-1 text-[#0F2A55]">{rows.length}</strong></span>
              <span>Active <strong className="ml-1 text-emerald-700">{counts.active}</strong></span>
              <span>Onboarding <strong className="ml-1 text-amber-700">{counts.onboarding}</strong></span>
            </div>
          </div>
          {error ? <div className="px-5 py-14 text-center text-[11px] text-red-700">The register could not be loaded.</div> : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] table-fixed text-left text-[10.5px]">
                <thead className="border-b bg-[#FAFBFD] text-[8.5px] uppercase tracking-[0.03em] text-[#64748B]"><tr>
                  <th className="px-5 py-3.5">{title} Name</th>
                  <th className="px-3 py-3.5">Mobile Number</th>
                  <th className="px-3 py-3.5">{title} ID</th>
                  <th className="px-3 py-3.5">Parent Partner</th>
                  <th className="px-3 py-3.5">Assigned RM</th>
                  <th className="px-3 py-3.5">Account status</th>
                  <th className="px-3 py-3.5 text-right">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-[#E7ECF3]">{rows.map((row) => {
                  const app = appMap.get(row.application_id ?? "");
                  const stage = stageFor(app);
                  const partnerId = app?.partner_record_id ? partnerMap.get(app.partner_record_id) : null;
                  const registrationCode = app?.registration_record_id ? registrationMap.get(app.registration_record_id) : null;
                  const accountId = permanentAccountId(row, app, profileMap.get(row.application_id ?? ""), registrationCode, partnerId);
                  const rm = textValue(app?.draft_data?.associate_name) ?? "Not assigned";
                  return <tr key={row.id} className="transition hover:bg-[#F8FAFF]">
                    <td className="truncate px-5 py-3.5 font-semibold text-[#0F2A55]" title={row.display_name}>{row.display_name}</td>
                    <td className="truncate px-3 py-3.5 font-medium text-[#17203A]" title={mobile10(row.mobile)}>{mobile10(row.mobile)}</td>
                    <td className="truncate px-3 py-3.5 font-semibold text-[#0F2A55]" title={accountId ?? `${title} ID pending`}>{accountId ?? `${title} ID pending`}</td>
                    <td className="truncate px-3 py-3.5 font-medium text-[#17203A]" title={partnerId ?? "Partner ID pending"}>{partnerId ?? "Partner ID pending"}</td>
                    <td className={`truncate px-3 py-3.5 font-medium ${rm === "Not assigned" ? "text-amber-700" : "text-[#17203A]"}`} title={rm}>{rm}</td>
                    <td className="px-3 py-3.5"><StatusBadge value={accountStatusLabel(row.account_status, stage)} /></td>
                    <td className="px-3 py-3.5 text-right">{row.application_id ? <FreshAccountReviewLink href={`/intermediaries/applications/${row.application_id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-[#C9D5E5] bg-white px-3 text-[9px] font-semibold text-[#0F2A55] transition hover:border-[#9AA9FF] hover:bg-[#F7F9FF]">Open</FreshAccountReviewLink> : <span className="text-[#94A3B8]">—</span>}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          ) : <div className="px-5 py-16 text-center"><p className="text-[12px] font-semibold">No {title} accounts found</p><p className="mt-1 text-[9.5px] text-[#64748B]">Create the first {title} account or change the search term.</p></div>}
        </section>
      </div>
    </AppShell>
  );
}

function stageFor(app: ApplicationRow | undefined) {
  const status = app?.registration_status?.toLowerCase() ?? "";
  if (status === "iib_registered") return "Active";
  if (status === "iib_submitted") return "IIB submitted";
  if (status.includes("iib")) return "IIB pending";
  if (status === "agreement_signed") return "Agreement signed";
  if (status === "agreement_sent") return "Agreement sent";
  if (status.includes("agreement")) return "Agreement pending";
  if (status === "exam_passed") return "Exam passed";
  if (status === "exam_in_progress") return "Exam in progress";
  if (status === "exam_allotted") return "Exam allotted";
  if (status === "exam_failed") return "Exam failed";
  if (status.includes("exam")) return "Exam pending";
  if (status === "training_completed") return "Training completed";
  if (status === "training_in_progress") return "Training in progress";
  if (status === "training_assigned") return "Training assigned";
  if (status.includes("training")) return "Training pending";
  return "Onboarding started";
}
function permanentAccountId(row: IntermediaryRow, app: ApplicationRow | undefined, profile: ProfileRow | undefined, registrationCode: string | null | undefined, partnerId: string | null | undefined) {
  const draft = app?.draft_data ?? {};
  const candidates = [
    profile?.existing_registration_code,
    profile?.external_onboarding_id,
    textValue(draft.issued_registration_code),
    textValue(draft.legacy_registration_code),
    registrationCode,
    row.intermediary_code,
    row.onboarding_id,
  ];
  return candidates.map((value) => value?.trim()).find((value): value is string => isPermanentRegistrationCode(value, partnerId)) ?? null;
}
function isPermanentRegistrationCode(value: string | null | undefined, partnerId: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized.startsWith("PENDING-") || normalized.startsWith("PART-")) return false;
  return !partnerId || normalized !== partnerId.trim().toUpperCase();
}
function accountStatusLabel(status: string, stage: string) {
  if (stage === "Active") return "Active";
  if (status === "suspended") return "Suspended";
  if (status === "inactive") return "Inactive";
  return "Under onboarding";
}
function textValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function mobile10(value: string | null | undefined) { const digits = value?.replace(/\D/g, "") ?? ""; return digits.length >= 10 ? digits.slice(-10) : digits || "—"; }
function StageBadge({ value }: { value: string }) { const active = value === "Active"; const failed = value.toLowerCase().includes("failed"); return <span className={`inline-flex max-w-full truncate rounded-md border px-2 py-1 text-[8.5px] font-semibold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : failed ? "border-red-200 bg-red-50 text-red-700" : "border-[#DCE5FF] bg-[#F3F6FF] text-[#315FEA]"}`}>{value}</span>; }
function StatusBadge({ value }: { value: string }) { const cls = value === "Active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : value === "Suspended" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"; return <span className={`inline-flex rounded-md border px-2 py-1 text-[8.5px] font-semibold ${cls}`}>{value}</span>; }