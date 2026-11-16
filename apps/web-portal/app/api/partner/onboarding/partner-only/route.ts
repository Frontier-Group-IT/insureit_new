import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { isEmployeeWithinAccessScope } from "@/lib/employee-access-scope";

export const dynamic = "force-dynamic";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^[6-9][0-9]{9}$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
type Payload = {
  pos_first_name?: unknown; pos_middle_name?: unknown; pos_last_name?: unknown;
  document_received_at?: unknown; associate_employee_id?: unknown;
  aadhaar_number?: unknown; date_of_birth?: unknown;
  mobile?: unknown; email?: unknown; pan_number?: unknown; gst_number?: unknown;
  address?: unknown; city?: unknown; state?: unknown; postal_code?: unknown;
  bank_id?: unknown; bank_account_number?: unknown; bank_ifsc_code?: unknown;
};
const reply = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const clean = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

export async function GET(request: Request) { return handle(request, false); }
export async function POST(request: Request) { return handle(request, true); }

async function handle(request: Request, writing: boolean) {
  // Do not grant intermediary, POSP, MISP, group or branch accounts the ability
  // to create another intermediary. This is an explicitly employee-scoped action.
  const bearer = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!bearer) return reply({ ok: false, error: "Sign in again to continue." }, 401);
  if (Number(request.headers.get("content-length") ?? 0) > 8192) {
    return reply({ ok: false, error: "Request is too large." }, 413);
  }
  const scoped = createSupabaseWithAccessToken(bearer[1]);
  const { data: auth, error: authError } = await scoped.auth.getUser(bearer[1]);
  if (authError || !auth.user) return reply({ ok: false, error: "Sign in again to continue." }, 401);
  const { data: identity, error: identityError } = await scoped.rpc("partner_app_current_identity");
  if (identityError || !identity || identity.actor_kind !== "employee"
    || identity.auth_user_id !== auth.user.id || identity.profile_id !== auth.user.id) {
    return reply({ ok: false, error: "Only authorized employees can add Partners." }, 403);
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,role,is_active,employee_id").eq("id", auth.user.id).maybeSingle();
  if (profileError || !profile?.is_active || !profile.employee_id || profile.role !== identity.role) {
    return reply({ ok: false, error: "Employee account is not active." }, 403);
  }
  const { data: employee, error: employeeError } = await admin.from("employees")
    .select("id,full_name,employee_code,employment_status").eq("id", profile.employee_id).maybeSingle();
  if (employeeError || employee?.employment_status !== "active") {
    return reply({ ok: false, error: "Employee account is not active." }, 403);
  }
  const permissions = await getEffectivePermissionAccessMap(profile);
  if (!["edit", "approve"].includes(permissions.create_intermediary_application ?? "none")) {
    return reply({ ok: false, error: "You do not have Add Partner permission." }, 403);
  }
  if (!(await isEmployeeWithinAccessScope(profile.id, profile.role, profile.employee_id))) {
    return reply({ ok: false, error: "Your employee assignment is not authorized." }, 403);
  }

  if (!writing) {
    const [rmRows, bankRows] = await Promise.all([
      admin.from("employees").select("id,full_name,employee_code").ilike("department", "sales").eq("employment_status", "active").order("full_name"),
      admin.from("banks").select("id,name").eq("is_active", true).order("name"),
    ]);
    if (rmRows.error || bankRows.error) return reply({ ok: false, error: "Master data is unavailable." }, 503);
    const inScope = await Promise.all((rmRows.data ?? []).map(async rm =>
      (await isEmployeeWithinAccessScope(profile.id, profile.role, rm.id)) ? { id: rm.id, name: `${rm.full_name || "Unnamed RM"}${rm.employee_code ? ` - ${rm.employee_code}` : ""}` } : null
    ));
    return reply({ ok: true, rms: inScope.filter((row): row is NonNullable<typeof row> => row !== null),
      banks: (bankRows.data ?? []).map(bank => ({ id: bank.id, name: bank.name })) });
  }

  let input: Payload;
  try {
    input = await request.json() as Payload;
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid payload");
  } catch {
    return reply({ ok: false, error: "Invalid Partner details." }, 400);
  }
  // Partner-only: schema requires the individual account family internally;
  // no POSP registration is created, selected, or exposed to users.
  const schemaFamily = "posp";
  const first = clean(input.pos_first_name, 70);
  const middle = clean(input.pos_middle_name, 70);
  const last = clean(input.pos_last_name, 70);
  const name = [first, middle, last].filter(Boolean).join(" ");
  const mobile = clean(input.mobile, 20);
  const email = clean(input.email, 150).toLowerCase();
  const pan = clean(input.pan_number, 20).toUpperCase().replace(/\\s+/g, "");
  const aadhaar = clean(input.aadhaar_number, 18).replace(/\\s+/g, "");
  const dob = clean(input.date_of_birth, 10);
  const receivedAt = clean(input.document_received_at, 10) || null;
  const rmId = clean(input.associate_employee_id, 40);
  const bankId = clean(input.bank_id, 40);
  const bankAccount = clean(input.bank_account_number, 24).replace(/\\s/g, "");
  const ifsc = clean(input.bank_ifsc_code, 12).toUpperCase();
  const gst = clean(input.gst_number, 20).toUpperCase().replace(/\\s+/g, "");
  const address = clean(input.address, 300);
  const city = clean(input.city, 80);
  const state = clean(input.state, 80);
  const pin = clean(input.postal_code, 10);
  if (!first || !MOBILE.test(mobile) || !EMAIL.test(email) || !PAN.test(pan)
    || !/^[0-9]{12}$/.test(aadhaar) || !validDate(dob) || dob > new Date().toISOString().slice(0,10)
    || (receivedAt && !validDate(receivedAt))
    || !address || !city || !state || !/^[0-9]{6}$/.test(pin)
    || !/^[0-9]{6,20}$/.test(bankAccount) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)
    || (gst && !GST.test(gst))) {
    return reply({ ok: false, error: "Complete all required identity, address and bank details." }, 400);
  }
  if (!rmId || !(await isEmployeeWithinAccessScope(profile.id, profile.role, rmId))) {
    return reply({ ok: false, error: "Select an RM in your authorized reporting hierarchy." }, 403);
  }
  const [{ data: rm }, { data: rmProfile }, { data: bank }] = await Promise.all([
    admin.from("employees").select("id,full_name,employee_code").eq("id", rmId).ilike("department", "sales").eq("employment_status", "active").maybeSingle(),
    admin.from("profiles").select("id").eq("employee_id", rmId).eq("is_active", true).maybeSingle(),
    admin.from("banks").select("id,name").eq("id", bankId).eq("is_active", true).maybeSingle(),
  ]);
  if (!rm || !rmProfile || !bank) return reply({ ok: false, error: "Select a valid active RM and Bank." }, 400);
  const aadhaarHash = createHash("sha256").update(aadhaar).digest("hex");
  const aadhaarEncrypted = encryptSensitiveValue(aadhaar);

  // Do not expose any matching existing Partner details to the applicant.
  const [{ data: existingProfiles, error: profilesError }, { data: existingPartners, error: partnersError }] = await Promise.all([
    admin.from("posp_misp_onboarding_profiles").select("application_id").ilike("pan_number", pan).limit(1),
    admin.from("partners").select("id").ilike("pan_number", pan).limit(1),
  ]);
  if (profilesError || partnersError) return reply({ ok: false, error: "Unable to check for existing Partner accounts." }, 503);
  if (existingProfiles?.length || existingPartners?.length) {
    return reply({ ok: false, error: "An application or Partner already exists for this PAN. Contact Operations." }, 409);
  }

  let applicationId: string | null = null;
  try {
    const now = new Date().toISOString();
    const draft = {
      account_context: "partner", partner_type: schemaFamily,
      associate_employee_id: rm.id, associate_profile_id: rmProfile.id,
      associate_name: rm.full_name, associate_id: rm.employee_code,
      document_received_at: receivedAt, pos_name: name,
      pos_first_name: first, pos_middle_name: middle || null, pos_last_name: last || null,
      applicant_phone: mobile, applicant_email: email, pan_number: pan,
      date_of_birth: dob, aadhaar_last_four: aadhaar.slice(-4),
      bank_id: bank.id, bank_name: bank.name, bank_account_last_four: bankAccount.slice(-4),
      bank_ifsc_code: ifsc, gst_number: gst || null,
      address, city, state, postal_code: pin, mobile_partner_only: true,
    };
    const { data: app, error: appError } = await admin.from("intermediary_onboarding_applications").insert({
      initiated_by: profile.id, source: "manager_portal", requested_type: schemaFamily,
      final_type: null, status: "submitted", partner_status: "draft",
      current_step: 2, applicant_phone: mobile, applicant_email: email,
      draft_data: draft, submitted_at: now, updated_at: now,
    }).select("id").single<{ id: string }>();
    if (appError || !app) throw new Error("Application insert failed");
    applicationId = app.id;
    const { error: detailsError } = await admin.from("posp_misp_onboarding_profiles").insert({
      application_id: app.id, partner_type: schemaFamily, requested_account_type: schemaFamily,
      final_account_type: null, partner_decision: "not_applicable",
      associate_employee_id: rm.id, associate_profile_id: rmProfile.id,
      associate_name: rm.full_name, associate_id: rm.employee_code,
      document_received_at: receivedAt,
      external_onboarding_id: `PENDING-${schemaFamily.toUpperCase()}-${app.id}`,
      pos_name: name,
      applicant_phone: mobile, applicant_email: email, pan_number: pan,
      date_of_birth: dob, aadhaar_last_four: aadhaar.slice(-4),
      aadhaar_hash: aadhaarHash, aadhaar_number_encrypted: aadhaarEncrypted,
      bank_id: bank.id, bank_name: bank.name, bank_account_number: bankAccount,
      bank_ifsc_code: ifsc, gst_number: gst || null,
      address, city, state, postal_code: pin,
      workflow_stage: "iib_processing", source: "manual",
      raw_data: { account_context: "partner", mobile_partner_only: true },
      created_by: profile.id, updated_by: profile.id,
    });
    if (detailsError) throw new Error("Profile insert failed");
    const { error: contactError } = await admin.from("intermediary_onboarding_contacts").insert({
      application_id: app.id,
      contact_role: "posp",
      full_name: name, phone: mobile, email,
      is_designated_person: false, login_required: false, membership_status: "pending",
    });
    if (contactError) throw new Error("Contact insert failed");
    return reply({ ok: true, application_id: app.id, status: "submitted" }, 201);
  } catch {
    // Return no success on partial persistence and clean up only our new draft.
    if (applicationId) {
      await admin.from("intermediary_onboarding_contacts").delete().eq("application_id", applicationId);
      await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id", applicationId);
      await admin.from("intermediary_onboarding_applications").delete().eq("id", applicationId);
    }
    return reply({ ok: false, error: "Partner application could not be saved. Please contact Operations." }, 500);
  }
}

function validDate(value: string): boolean {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
