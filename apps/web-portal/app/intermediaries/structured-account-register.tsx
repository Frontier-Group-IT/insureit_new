import { AppShell } from "@/components/shell";
import { getAccessibleIntermediaryIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  StructuredAccountRegisterClient,
  type StructuredAccountRegisterRow,
  type StructuredAccountStatus,
} from "./structured-account-register-client";

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
type PartnerApplicationLink = { id: string; partner_record_id: string | null; account_context: string | null };

const APP_SELECT = "id,registration_status,draft_data,partner_record_id,registration_record_id";

export async function StructuredAccountRegister({
  type,
  search = "",
  status = "all",
}: {
  type: AccountType;
  search?: string;
  status?: StructuredAccountStatus;
}) {
  const profile = await requirePospMispManager();
  const admin = createSupabaseAdminClient();
  const accessibleIds = await getAccessibleIntermediaryIds(profile!.id, profile!.role);

  let request = admin
    .from("intermediaries")
    .select("id,intermediary_code,onboarding_id,display_name,mobile,email,city,account_status,application_id,updated_at")
    .eq("intermediary_type", type)
    .order("updated_at", { ascending: false })
    .limit(250);

  if (accessibleIds !== null) {
    request = accessibleIds.length ? request.in("id", accessibleIds) : request.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }

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
  const { data: partnerApplications } = partnerIds.length
    ? await admin
        .from("intermediary_onboarding_applications")
        .select("id,partner_record_id,account_context:draft_data->>account_context")
        .in("partner_record_id", partnerIds)
        .returns<PartnerApplicationLink[]>()
    : { data: [] as PartnerApplicationLink[] };

  const partnerApplicationMap = new Map<string, string>();
  for (const partnerApplication of partnerApplications ?? []) {
    const context = partnerApplication.account_context;
    if (!partnerApplication.partner_record_id || context === "posp" || context === "misp") continue;
    if (!partnerApplicationMap.has(partnerApplication.partner_record_id)) {
      partnerApplicationMap.set(partnerApplication.partner_record_id, partnerApplication.id);
    }
  }

  const title = type.toUpperCase();
  const registerRows: StructuredAccountRegisterRow[] = rows.map((row) => {
    const app = appMap.get(row.application_id ?? "");
    const stage = stageFor(app);
    const partnerId = app?.partner_record_id ? partnerMap.get(app.partner_record_id) : null;
    const partnerApplicationId = app?.partner_record_id ? partnerApplicationMap.get(app.partner_record_id) : null;
    const registrationCode = app?.registration_record_id ? registrationMap.get(app.registration_record_id) : null;
    const accountId = permanentAccountId(row, app, profileMap.get(row.application_id ?? ""), registrationCode, partnerId);
    const rm = textValue(app?.draft_data?.associate_name) ?? "Not assigned";

    return {
      id: row.id,
      applicationId: row.application_id,
      displayName: row.display_name,
      mobile: mobile10(row.mobile),
      email: row.email ?? "",
      city: row.city ?? "",
      accountId,
      partnerId: partnerId ?? null,
      partnerApplicationId: partnerApplicationId ?? null,
      rm,
      stage,
      accountStatus: accountStatusLabel(row.account_status, stage),
      searchText: [
        row.display_name,
        mobile10(row.mobile),
        row.email,
        row.city,
        accountId,
        partnerId,
        row.intermediary_code,
        row.onboarding_id,
        rm,
      ].filter(Boolean).join(" ").toLowerCase(),
    };
  });

  return (
    <AppShell title={`${title} Register`}>
      <StructuredAccountRegisterClient
        type={type}
        title={title}
        rows={registerRows}
        initialSearch={search}
        initialStatus={status}
        loadError={Boolean(error)}
      />
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

function permanentAccountId(
  row: IntermediaryRow,
  app: ApplicationRow | undefined,
  profile: ProfileRow | undefined,
  registrationCode: string | null | undefined,
  partnerId: string | null | undefined,
) {
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

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mobile10(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? digits.slice(-10) : digits || "-";
}
