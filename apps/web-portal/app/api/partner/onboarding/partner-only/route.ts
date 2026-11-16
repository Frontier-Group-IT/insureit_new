import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { isEmployeeWithinAccessScope } from "@/lib/employee-access-scope";

export const dynamic = "force-dynamic";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^[6-9][0-9]{9}$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
type PartnerKind = "individual" | "business";
type Payload = {
  partner_kind?: unknown; name?: unknown; mobile?: unknown; email?: unknown;
  pan_number?: unknown; gst_number?: unknown; address?: unknown; city?: unknown;
  state?: unknown; postal_code?: unknown;
};
const reply = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const clean = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

export async function POST(request: Request) {
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

  let input: Payload;
  try {
    input = await request.json() as Payload;
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid payload");
  } catch {
    return reply({ ok: false, error: "Invalid Partner details." }, 400);
  }
  const kind = input.partner_kind;
  if (kind !== "individual" && kind !== "business") {
    return reply({ ok: false, error: "Choose Individual or Business Partner." }, 400);
  }
  const partnerKind: PartnerKind = kind;
  // Schema internally retains a requested POSP/MISP family, but this workflow
  // only creates a Partner-context application. It never issues a registration.
  const schemaFamily = partnerKind === "business" ? "misp" : "posp";
  const name = clean(input.name, 120);
  const mobile = clean(input.mobile, 20);
  const email = clean(input.email, 150).toLowerCase();
  const pan = clean(input.pan_number, 20).toUpperCase().replace(/\s+/g, "");
  const gst = clean(input.gst_number, 20).toUpperCase().replace(/\s+/g, "");
  const address = clean(input.address, 300);
  const city = clean(input.city, 80);
  const state = clean(input.state, 80);
  const pin = clean(input.postal_code, 10);
  if (name.length < 2 || !MOBILE.test(mobile) || !EMAIL.test(email) || !PAN.test(pan)
    || !address || !city || !state || !/^[0-9]{6}$/.test(pin) || (gst && !GST.test(gst))) {
    return reply({ ok: false, error: "Complete all required Partner details with valid mobile, email, PAN and PIN." }, 400);
  }

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
      account_context: "partner", partner_kind: partnerKind, partner_type: schemaFamily,
      associate_employee_id: employee.id, associate_profile_id: profile.id,
      associate_name: employee.full_name, associate_id: employee.employee_code,
      pos_name: partnerKind === "individual" ? name : null,
      pos_first_name: partnerKind === "individual" ? name : null,
      misp_name: partnerKind === "business" ? name : null,
      applicant_phone: mobile, applicant_email: email, pan_number: pan,
      gst_number: gst || null, address, city, state, postal_code: pin,
      mobile_partner_only: true,
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
      associate_employee_id: employee.id, associate_profile_id: profile.id,
      associate_name: employee.full_name, associate_id: employee.employee_code,
      external_onboarding_id: `PENDING-${schemaFamily.toUpperCase()}-${app.id}`,
      pos_name: partnerKind === "individual" ? name : null,
      misp_name: partnerKind === "business" ? name : null,
      applicant_phone: mobile, applicant_email: email, pan_number: pan,
      gst_number: gst || null, address, city, state, postal_code: pin,
      workflow_stage: "iib_processing", source: "manual",
      raw_data: { account_context: "partner", partner_kind: partnerKind, mobile_partner_only: true },
      created_by: profile.id, updated_by: profile.id,
    });
    if (detailsError) throw new Error("Profile insert failed");
    const { error: contactError } = await admin.from("intermediary_onboarding_contacts").insert({
      application_id: app.id,
      contact_role: schemaFamily === "misp" ? "misp_dp" : "posp",
      full_name: name, phone: mobile, email,
      is_designated_person: schemaFamily === "misp", login_required: false, membership_status: "pending",
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
