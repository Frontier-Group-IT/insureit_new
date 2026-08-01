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
        <div className="flex gap-3">
          <form method="get" className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input name="q" defaultValue={search} placeholder={`Search ${title} name, ID, Partner ID, mobile or email`} className="h-12 w-full rounded-2xl border border-[#D8E1EC] bg-white/80 pl-11 pr-4 text-[11px] shadow-sm outline-none focus:border-[#9AA9FF] focus:ring-2 focus:ring-[#E4E8FF]" />
          </form>
          <Link href={onboardHref} className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#C9D5E5] bg-white px-5 text-[10.5px] font-bold text-[#0F2A55] shadow-sm hover:border-[#9AA9FF]">Onboard {title}</Link>
        </div>

        <section className="grid overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm sm:grid-cols-3">
          <Metric label={`Total ${title} accounts`} value={rows.length} />
          <Metric label="Under onboarding" value={counts.onboarding} />
          <Metric label="Active accounts" value={counts.active} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <div className="border-b bg-[#FAFBFD] px-5 py-4">
            <h2 className="text-[12.5px] font-semibold text-[#17203A]">{title} account register</h2>
            <p className="mt-1 text-[9px] text-[#64748B]">Current onboarding position, ownership and next action for every {title} account.</p>
          </div>
          {error ? <div className="px-5 py-14 text-center text-[11px] text-red-700">The register could not be loaded.</div> : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1260px] text-left text-[10.5px]">
                <thead className="border-b bg-[#FAFBFD] text-[8.5px] uppercase tracking-[0.03em] text-[#64748B]"><tr>
                  <th className="px-5 py-3.5">{title} account</th>
                  <th className="px-3 py-3.5">{title} ID</th>
                  <th className="px-3 py-3.5">Parent Partner</th>
                  <th className="px-3 py-3.5">Assigned RM</th>
                  <th className="px-3 py-3.5">Current stage</th>
                  <th className="px-3 py-3.5">Account status</th>
                  <th className="px-3 py-3.5">Last updated</th>
                  <th className="px-3 py-3.5">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-[#E7ECF3]">{rows.map((row) => {
                  const app = appMap.get(row.application_id ?? "");
                  const stage = stageFor(app);
                  const partnerId = app?.partner_record_id ? partnerMap.get(app.partner_record_id) : null;
                  const registrationCode = app?.registration_record_id ? registrationMap.get(app.registration_record_id) : null;
                  const accountId = permanentAccountId(row, app, profileMap.get(row.application_id ?? ""), registrationCode, partnerId);
                  const rm = textValue(app?.draft_data?.associate_name) ?? "Not assigned";
                  return <tr key={row.id} className="transition hover:bg-[#F8FAFF]">
                    <td className="px-5 py-4"><p className="font-semibold text-[#0F2A55]">{row.display_name}</p><p className="mt-1 text-[8.5px] text-[#64748B]">{[row.city, row.mobile].filter(Boolean).join(" · ") || row.email || "Contact not available"}</p></td>
                    <td className="px-3 py-4"><p className="font-semibold text-[#0F2A55]">{accountId ?? `${title} ID pending`}</p>{accountId && !accountId.startsWith(`${title}-`) ? <p className="mt-1 text-[8px] text-[#64748B]">Existing issued ID</p> : null}</td>
                    <td className="px-3 py-4"><p className="font-medium text-[#17203A]">{partnerId ?? "Partner ID pending"}</p></td>
                    <td className="px-3 py-4"><p className={rm === "Not assigned" ? "font-medium text-amber-700" : "font-medium text-[#17203A]"}>{rm}</p></td>
                    <td className="px-3 py-4"><StageBadge value={stage} /></td>
                    <td className="px-3 py-4"><StatusBadge value={accountStatusLabel(row.account_status, stage)} /></td>
                    <td className="px-3 py-4 text-[#475569]">{formatDate(row.updated_at)}</td>
                    <td className="px-3 py-4">{row.application_id ? <FreshAccountReviewLink href={`/intermediaries/applications/${row.application_id}`} className="inline-flex rounded-lg bg-[#0F2A55] px-3 py-2 text-[9px] font-semibold text-white hover:bg-[#173A70]">{stage === "Active" ? `View ${title}` : "Continue onboarding"}</FreshAccountReviewLink> : <span className="text-[#94A3B8]">—</span>}</td>
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
    row.intermediary_code,
    row.onboarding_id,
    registrationCode,
    profile?.existing_registration_code,
    profile?.external_onboarding_id,
    textValue(draft.issued_registration_code),
    textValue(draft.legacy_registration_code),
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
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date); }
function Metric({ label, value }: { label: string; value: number }) { return <div className="border-r border-[#E2E8F0] px-5 py-4 last:border-r-0"><p className="text-[8.5px] uppercase tracking-[0.04em] text-[#64748B]">{label}</p><p className="mt-1 text-[22px] font-semibold text-[#0F2A55]">{value}</p></div>; }
function StageBadge({ value }: { value: string }) { const active = value === "Active"; const failed = value.includes("failed"); return <span className={`inline-flex rounded-full px-2.5 py-1 text-[8.5px] font-semibold ${active ? "bg-emerald-50 text-emerald-700" : failed ? "bg-red-50 text-red-700" : "bg-indigo-50 text-indigo-700"}`}>{value}</span>; }
function StatusBadge({ value }: { value: string }) { const cls = value === "Active" ? "bg-emerald-50 text-emerald-700" : value === "Suspended" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[8.5px] font-semibold ${cls}`}>{value}</span>; }