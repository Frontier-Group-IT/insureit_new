"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { approvePortalOnboardingApplication, beginPortalOnboardingApplication, markPortalOnboardingForCorrection } from "./onboarding-applications";

export type CorporateOnboardingState = { error: string | null; field: string | null };
const BUCKET = "customer-documents";
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CONTACT_ROLES = ["ceo_head", "admin_head", "dedicated_spoc"] as const;

type ValidCorporateContact = { role: (typeof CONTACT_ROLES)[number]; name: string; phone: string; email: string | null };
function fail(error: string, field: string | null = null): CorporateOnboardingState { return { error, field }; }
function text(data: FormData, name: string) { const value = data.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function upload(data: FormData, name: string) { const value = data.get(name); return value instanceof File && value.size > 0 ? value : null; }
function phone(value: string | null) { if (!value) return null; const digits = value.replace(/\D/g, ""); return digits.length === 10 ? `+91${digits}` : null; }
function ext(value: File) { return value.type === "application/pdf" ? "pdf" : value.type === "image/png" ? "png" : "jpg"; }
function checkFile(value: File | null, label: string, required = false) { if (!value) return required ? `${label} is required.` : null; if (!ALLOWED.has(value.type)) return `${label} must be PDF, JPG or PNG.`; if (value.size > 5 * 1024 * 1024) return `${label} must be 5 MB or smaller.`; return null; }

export async function createCorporateOnboarding(_state: CorporateOnboardingState, data: FormData): Promise<CorporateOnboardingState> {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || !canManageMasterData(profile.role)) return fail("You are not authorized to onboard corporate customers.");

  const companyName = text(data, "company_name");
  const companyPan = text(data, "company_pan")?.replace(/\s/g, "").toUpperCase() ?? null;
  const gstNumber = text(data, "gst_number")?.replace(/\s/g, "").toUpperCase() ?? null;
  const city = text(data, "city"); const state = text(data, "state"); const postalCode = text(data, "postal_code");
  const locationId = text(data, "india_location_id"); const fleetSize = text(data, "fleet_size_band");
  const groupCustomerId = text(data, "group_customer_id");
  if (!companyName) return fail("Enter the company name.", "company_name");
  if (!companyPan || !PAN.test(companyPan)) return fail("Enter a valid company PAN number.", "company_pan");
  if (gstNumber && !GST.test(gstNumber)) return fail("Enter a valid GST number.", "gst_number");
  if (!locationId || !city || !state || !postalCode) return fail("Select a city and confirm State and PIN Code.", "city_search");
  if (!fleetSize) return fail("Select the fleet size.", "fleet_size_band");

  const companyPanCopy = upload(data, "company_pan_copy"); const gstCopy = upload(data, "gst_copy");
  const panFileError = checkFile(companyPanCopy, "Company PAN copy", true); if (panFileError) return fail(panFileError, "company_pan_copy");
  const gstFileError = checkFile(gstCopy, "GST certificate", Boolean(gstNumber)); if (gstFileError) return fail(gstFileError, "gst_copy");

  const rawContacts = CONTACT_ROLES.map((role) => ({ role, name: text(data, `${role}_name`), phone: phone(text(data, `${role}_mobile`)), email: text(data, `${role}_email`) }));
  for (const contact of rawContacts) { if (!contact.name) return fail(`Enter the ${contact.role.replaceAll("_", " ")} name.`, `${contact.role}_name`); if (!contact.phone) return fail(`Enter a valid 10-digit mobile for ${contact.role.replaceAll("_", " ")}.`, `${contact.role}_mobile`); }
  const contacts: ValidCorporateContact[] = rawContacts.map((contact) => ({ role: contact.role, name: contact.name!, phone: contact.phone!, email: contact.email }));
  if (new Set(contacts.map((contact) => contact.phone)).size !== contacts.length) return fail("Each corporate login contact must use a different mobile number.", "ceo_head_mobile");
  const dedicatedSpoc = contacts.find((contact) => contact.role === "dedicated_spoc");
  if (!dedicatedSpoc) return fail("Dedicated SPOC contact is required.", "dedicated_spoc_name");

  const admin = createSupabaseAdminClient();
  if (groupCustomerId) {
    const { data: group } = await admin.from("customers").select("id").eq("id", groupCustomerId).eq("partner_type", "group").eq("onboarding_status", "active").maybeSingle<{ id: string }>();
    if (!group) return fail("Select an active Group customer.", "group_customer_id");
  }

  let application: { id: string };
  try { application = await beginPortalOnboardingApplication(admin, { initiatedBy: profile.id, partnerType: "corporate", phone: dedicatedSpoc.phone, email: dedicatedSpoc.email, draftData: { company_name: companyName, city, state, postal_code: postalCode, fleet_size_band: fleetSize, has_gst: Boolean(gstNumber), login_contact_count: 3, group_customer_id: groupCustomerId } }); }
  catch (error) { return fail(`Onboarding application could not be prepared: ${error instanceof Error ? error.message : "Unknown error"}`); }

  const correction = async (message: string) => { await markPortalOnboardingForCorrection(admin, application.id, message); };
  const street = text(data, "address_street"); const locality = text(data, "address_locality"); const address = [street, locality, city, state, postalCode].filter(Boolean).join(", ");
  const { data: customer, error: customerError } = await admin.from("customers").insert({ customer_code: `CUST-${Date.now().toString().slice(-9)}`, partner_type: "corporate", contact_name: dedicatedSpoc.name, company_name: companyName, legal_trade_name: companyName, phone: dedicatedSpoc.phone, email: dedicatedSpoc.email, address, address_street: street, address_locality: locality, india_location_id: locationId, city, state, postal_code: postalCode, is_gst_registered: Boolean(gstNumber), gst_number: gstNumber, pan_number: companyPan, fleet_size_band: fleetSize, onboarding_status: "active", created_by: profile.id, updated_by: profile.id }).select("id").single<{ id: string }>();
  if (customerError || !customer) { await correction(customerError?.message ?? "Corporate customer could not be saved."); return fail(`Corporate customer could not be saved: ${customerError?.message ?? "Unknown error"}`); }
  const cleanup = async () => { await admin.from("customers").delete().eq("id", customer.id); };

  if (groupCustomerId) {
    const { error: relationshipError } = await admin.rpc("link_customer_to_group", { p_group_customer_id: groupCustomerId, p_child_customer_id: customer.id, p_actor_profile_id: profile.id });
    if (relationshipError) { await cleanup(); await correction(relationshipError.message); return fail(`Group affiliation could not be saved: ${relationshipError.message}`, "group_customer_id"); }
  }

  const { error: contactError } = await admin.from("customer_onboarding_contacts").insert(contacts.map((contact) => ({ application_id: application.id, contact_role: contact.role, full_name: contact.name, phone: contact.phone, email: contact.email, login_required: true })));
  if (contactError) { await cleanup(); await correction(contactError.message); return fail(`Corporate contacts could not be saved: ${contactError.message}`); }

  const { error: membershipError } = await admin.from("customer_memberships").insert(contacts.map((contact) => ({ customer_id: customer.id, invited_phone: contact.phone, invited_email: contact.email, membership_role: contact.role, is_primary: contact.role === "dedicated_spoc", status: "pending", created_by: profile.id })));
  if (membershipError) { await cleanup(); await correction(membershipError.message); return fail(`Corporate login access could not be prepared: ${membershipError.message}`); }

  const { error: permanentContactError } = await admin.from("customer_contacts").insert(contacts.map((contact) => ({ customer_id: customer.id, contact_role: contact.role, full_name: contact.name, phone: contact.phone, email: contact.email, login_required: true, access_status: "pending", created_by: profile.id })));
  if (permanentContactError) { await cleanup(); await correction(permanentContactError.message); return fail(`Permanent Corporate contacts could not be saved: ${permanentContactError.message}`); }

  const documentMap: Array<[File | null, string, string]> = [[companyPanCopy, "company_pan_copy", "corporate_company_pan_copy"], [gstCopy, "gst_copy", "gst_copy"]];
  const uploadedPaths: string[] = [];
  for (const [selected, field, documentType] of documentMap) {
    if (!selected) continue;
    const path = `${customer.id}/corporate/${field}/${randomUUID()}.${ext(selected)}`;
    const { error: storageError } = await admin.storage.from(BUCKET).upload(path, new Uint8Array(await selected.arrayBuffer()), { contentType: selected.type, upsert: false });
    if (storageError) { if (uploadedPaths.length) await admin.storage.from(BUCKET).remove(uploadedPaths); await cleanup(); await correction(storageError.message); return fail(`Document upload failed: ${storageError.message}`, field); }
    uploadedPaths.push(path);
    const { error: recordError } = await admin.from("customer_documents").insert({ customer_id: customer.id, document_type: documentType, file_name: selected.name, storage_bucket: BUCKET, storage_path: path, mime_type: selected.type, file_size: selected.size, verification_status: "verified", upload_source: "manager_portal", uploaded_by: profile.id, verified_by: profile.id, verified_at: new Date().toISOString() });
    if (recordError) { await admin.storage.from(BUCKET).remove(uploadedPaths); await cleanup(); await correction(recordError.message); return fail(`Document record could not be saved: ${recordError.message}`, field); }
  }

  try { await approvePortalOnboardingApplication(admin, application.id, customer.id, profile.id); }
  catch (error) { return fail(`Corporate customer was created, but onboarding could not be completed: ${error instanceof Error ? error.message : "Unknown error"}`); }
  redirect("/customers?success=corporate_created");
}
