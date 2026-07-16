"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { approvePortalOnboardingApplication } from "../onboarding-applications";

type Draft = Record<string, unknown>;
type Application = { id:string; profile_id:string|null; partner_type:string|null; status:string; applicant_phone:string|null; applicant_email:string|null; group_customer_id:string|null; draft_data:Draft|null };
type Contact = { contact_role:string; full_name:string; phone:string; email:string|null };
type Document = { document_type:string; file_name:string; storage_bucket:string; storage_path:string; mime_type:string|null; file_size:number|null };
type Profile = { full_name:string|null };
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export async function approveMobileCorporateApplication(formData: FormData) {
  const applicationId = value(formData,"application_id");
  if (!applicationId) redirect("/customers/applications?error=missing_application");
  const reviewer = await requireMasterDataManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);
  const admin = createSupabaseAdminClient();
  const { data: application } = await admin.from("customer_onboarding_applications").select("id,profile_id,partner_type,status,applicant_phone,applicant_email,group_customer_id,draft_data").eq("id",applicationId).single<Application>();
  if (!application?.profile_id || application.partner_type !== "corporate" || !["submitted","under_review"].includes(application.status)) redirect(`/customers/applications/${applicationId}?error=application_not_ready`);
  const draft = application.draft_data ?? {};
  const companyName = text(draft.company_name); const pan = normalizeTaxId(draft.company_pan); const gst = normalizeTaxId(draft.gst_number);
  const street = text(draft.address_street); const locality = text(draft.address_locality); const locationId = text(draft.india_location_id);
  const city = text(draft.city); const state = text(draft.state); const postalCode = text(draft.postal_code); const fleet = text(draft.fleet_size_band);
  if (!companyName || !pan || !street || !locationId || !city || !state || !postalCode || !fleet) redirect(`/customers/applications/${applicationId}?error=incomplete_application`);
  if (!PAN_PATTERN.test(pan) || (gst && !GST_PATTERN.test(gst))) redirect(`/customers/applications/${applicationId}?error=invalid_corporate_details`);
  const { data: contacts } = await admin.from("customer_onboarding_contacts").select("contact_role,full_name,phone,email").eq("application_id",applicationId).returns<Contact[]>();
  const roles = ["ceo_head","admin_head","dedicated_spoc"];
  if (roles.some((role)=>!(contacts??[]).some((contact)=>contact.contact_role===role))) redirect(`/customers/applications/${applicationId}?error=contacts_incomplete`);
  const spoc = (contacts??[]).find((contact)=>contact.contact_role==="dedicated_spoc")!;
  const existingCreatorContact = (contacts??[]).find((contact)=>contact.contact_role==="corporate_creator");
  const { data: applicantProfile } = await admin.from("profiles").select("full_name").eq("id",application.profile_id).maybeSingle<Profile>();
  const creatorContact: Contact = existingCreatorContact ?? { contact_role:"corporate_creator", full_name:applicantProfile?.full_name?.trim() || "Corporate Creator", phone:application.applicant_phone ?? "", email:application.applicant_email };
  if (!samePhone(creatorContact.phone, application.applicant_phone)) redirect(`/customers/applications/${applicationId}?error=applicant_contact_mismatch`);
  const loginContacts = [creatorContact, ...(contacts??[]).filter((contact)=>contact.contact_role!=="corporate_creator")];
  if (new Set(loginContacts.map((contact)=>normalizePhone(contact.phone))).size !== loginContacts.length) redirect(`/customers/applications/${applicationId}?error=contacts_incomplete`);
  const spocPhoneDigits = normalizePhone(spoc.phone);
  if (spocPhoneDigits.length !== 10) redirect(`/customers/applications/${applicationId}?error=contacts_incomplete`);
  const spocPhone = `+91${spocPhoneDigits}`;
  const { data: documents } = await admin.from("customer_onboarding_documents").select("document_type,file_name,storage_bucket,storage_path,mime_type,file_size").eq("application_id",applicationId).returns<Document[]>();
  if (!(documents??[]).some((document)=>document.document_type==="company_pan_copy")) redirect(`/customers/applications/${applicationId}?error=documents_incomplete`);
  if (gst && !(documents??[]).some((document)=>document.document_type==="gst_copy")) redirect(`/customers/applications/${applicationId}?error=documents_incomplete`);
  const phoneCandidates = Array.from(new Set([spoc.phone, spocPhone, spocPhoneDigits].filter(Boolean)));
  const [{ data: duplicatePan }, { data: duplicatePhones }] = await Promise.all([
    admin.from("customers").select("id").eq("pan_number",pan).limit(1).maybeSingle<{id:string}>(),
    admin.from("customers").select("id,phone").in("phone",phoneCandidates).limit(5).returns<Array<{id:string;phone:string|null}>>()
  ]);
  if (duplicatePan || (duplicatePhones??[]).some((customer)=>normalizePhone(customer.phone)===spocPhoneDigits)) redirect(`/customers/applications/${applicationId}?error=customer_already_exists`);
  const customerId = randomUUID(); const now = new Date().toISOString();
  const { error: customerError } = await admin.from("customers").insert({ id:customerId, profile_id:null, customer_code:`CUST-${Date.now().toString().slice(-9)}`, partner_type:"corporate", contact_name:spoc.full_name, company_name:companyName, legal_trade_name:companyName, phone:spocPhone, email:spoc.email, address:[street,locality,city,state,postalCode].filter(Boolean).join(", "), address_street:street, address_locality:locality, india_location_id:locationId, city, state, postal_code:postalCode, pan_number:pan, is_gst_registered:Boolean(gst), gst_number:gst, fleet_size_band:fleet, onboarding_status:"active", onboarding_completed_at:now, created_by:reviewer.id, updated_by:reviewer.id });
  if (customerError) {
    console.error("Corporate customer create failed", customerError);
    if (customerError.code === "23505") redirect(`/customers/applications/${applicationId}?error=customer_already_exists`);
    if (customerError.code === "23514" || customerError.code === "23503") redirect(`/customers/applications/${applicationId}?error=invalid_corporate_details`);
    redirect(`/customers/applications/${applicationId}?error=customer_create_failed`);
  }

  const memberships = loginContacts.map((contact)=>({ customer_id:customerId, profile_id:contact.contact_role==="corporate_creator"?application.profile_id:null, invited_phone:contact.phone, invited_email:contact.email, membership_role:contact.contact_role, is_primary:contact.contact_role==="dedicated_spoc", status:contact.contact_role==="corporate_creator"?"active":"pending", created_by:reviewer.id }));
  const { error: membershipError } = await admin.from("customer_memberships").insert(memberships);
  if (membershipError) { await admin.from("customers").delete().eq("id",customerId); redirect(`/customers/applications/${applicationId}?error=membership_create_failed`); }

  const permanentContacts = loginContacts.map((contact)=>({ customer_id:customerId, contact_role:contact.contact_role, full_name:contact.full_name, phone:contact.phone, email:contact.email, profile_id:contact.contact_role==="corporate_creator"?application.profile_id:null, login_required:true, access_status:contact.contact_role==="corporate_creator"?"active":"pending", created_by:reviewer.id }));
  const { error: contactError } = await admin.from("customer_contacts").insert(permanentContacts);
  if (contactError) { await admin.from("customers").delete().eq("id",customerId); redirect(`/customers/applications/${applicationId}?error=contacts_create_failed`); }

  if (application.group_customer_id) {
    const { error: relationshipError } = await admin.rpc("link_customer_to_group", { p_group_customer_id: application.group_customer_id, p_child_customer_id: customerId, p_actor_profile_id: reviewer.id });
    if (relationshipError) { console.error("Group Corporate approval link failed", relationshipError); await admin.from("customers").delete().eq("id",customerId); redirect(`/customers/applications/${applicationId}?error=group_link_failed`); }
  }

  const copiedPaths:string[]=[]; const permanent:Record<string,unknown>[]=[];
  for (const document of documents??[]) { const download=await admin.storage.from(document.storage_bucket).download(document.storage_path); if(download.error||!download.data) redirect(`/customers/applications/${applicationId}?error=document_copy_failed`); const path=`${customerId}/${document.document_type}/${randomUUID()}.${extension(document)}`; const upload=await admin.storage.from("customer-documents").upload(path,new Uint8Array(await download.data.arrayBuffer()),{contentType:document.mime_type??"application/octet-stream",upsert:false}); if(upload.error) redirect(`/customers/applications/${applicationId}?error=document_copy_failed`); copiedPaths.push(path); permanent.push({customer_id:customerId,document_type:document.document_type,file_name:document.file_name,storage_bucket:"customer-documents",storage_path:path,mime_type:document.mime_type,file_size:document.file_size,verification_status:"verified",upload_source:"customer_app",uploaded_by:application.profile_id,verified_by:reviewer.id,verified_at:now}); }
  if(permanent.length){const result=await admin.from("customer_documents").insert(permanent);if(result.error){await admin.storage.from("customer-documents").remove(copiedPaths);await admin.from("customers").delete().eq("id",customerId);redirect(`/customers/applications/${applicationId}?error=document_records_failed`);}}
  await admin.from("customer_onboarding_contacts").upsert(loginContacts.map((contact)=>({application_id:applicationId,contact_role:contact.contact_role,full_name:contact.full_name,phone:contact.phone,email:contact.email,login_required:true,linked_profile_id:contact.contact_role==="corporate_creator"?application.profile_id:null,membership_status:contact.contact_role==="corporate_creator"?"active":"pending",updated_at:now})),{onConflict:"application_id,contact_role"});
  await admin.from("customer_onboarding_documents").update({verification_status:"verified",verified_by:reviewer.id,verified_at:now,rejection_reason:null}).eq("application_id",applicationId);
  await approvePortalOnboardingApplication(admin,applicationId,customerId,reviewer.id);
  revalidatePath("/customers"); revalidatePath("/customers/applications");
  redirect(`/customers/${customerId}/edit?success=corporate_kyc_approved`);
}
function value(data:FormData,name:string){const item=data.get(name);return typeof item==="string"&&item.trim()?item.trim():null;} function text(input:unknown){return typeof input==="string"&&input.trim()?input.trim():null;} function normalizeTaxId(input:unknown){return typeof input==="string"&&input.trim()?input.replace(/\s/g,"").toUpperCase():null;} function extension(document:Document){if(document.mime_type==="application/pdf")return"pdf";if(document.mime_type==="image/png")return"png";return"jpg";} function normalizePhone(value:string|null){return(value??"").replace(/\D/g,"").slice(-10);} function samePhone(left:string|null,right:string|null){const a=normalizePhone(left);const b=normalizePhone(right);return a.length===10&&a===b;}
