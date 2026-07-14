"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { approvePortalOnboardingApplication } from "../onboarding-applications";

type Draft = Record<string, unknown>;
type Application = { id:string; profile_id:string|null; partner_type:string|null; status:string; draft_data:Draft|null };
type Contact = { contact_role:string; full_name:string; phone:string; email:string|null };
type Document = { document_type:string; file_name:string; storage_bucket:string; storage_path:string; mime_type:string|null; file_size:number|null };

export async function approveMobileCorporateApplication(formData: FormData) {
  const applicationId = value(formData,"application_id");
  if (!applicationId) redirect("/customers/applications?error=missing_application");
  const reviewer = await requireMasterDataManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);
  const admin = await createServerSupabaseClient();
  const { data: application } = await admin.from("customer_onboarding_applications").select("id,profile_id,partner_type,status,draft_data").eq("id",applicationId).single<Application>();
  if (!application?.profile_id || application.partner_type !== "corporate" || !["submitted","under_review"].includes(application.status)) redirect(`/customers/applications/${applicationId}?error=application_not_ready`);
  const draft = application.draft_data ?? {};
  const companyName = text(draft.company_name); const pan = text(draft.company_pan); const gst = text(draft.gst_number);
  const street = text(draft.address_street); const locality = text(draft.address_locality); const locationId = text(draft.india_location_id);
  const city = text(draft.city); const state = text(draft.state); const postalCode = text(draft.postal_code); const fleet = text(draft.fleet_size_band);
  if (!companyName || !pan || !street || !locationId || !city || !state || !postalCode || !fleet) redirect(`/customers/applications/${applicationId}?error=incomplete_application`);
  const { data: contacts } = await admin.from("customer_onboarding_contacts").select("contact_role,full_name,phone,email").eq("application_id",applicationId).returns<Contact[]>();
  const roles = ["ceo_head","admin_head","dedicated_spoc"];
  if (roles.some((role)=>!(contacts??[]).some((contact)=>contact.contact_role===role))) redirect(`/customers/applications/${applicationId}?error=contacts_incomplete`);
  const spoc = (contacts??[]).find((contact)=>contact.contact_role==="dedicated_spoc")!;
  const { data: documents } = await admin.from("customer_onboarding_documents").select("document_type,file_name,storage_bucket,storage_path,mime_type,file_size").eq("application_id",applicationId).returns<Document[]>();
  if (!(documents??[]).some((document)=>document.document_type==="company_pan_copy")) redirect(`/customers/applications/${applicationId}?error=documents_incomplete`);
  if (gst && !(documents??[]).some((document)=>document.document_type==="gst_copy")) redirect(`/customers/applications/${applicationId}?error=documents_incomplete`);
  const { data: duplicate } = await admin.from("customers").select("id").or(`pan_number.eq.${pan},phone.eq.${spoc.phone}`).limit(1).maybeSingle<{id:string}>();
  if (duplicate) redirect(`/customers/applications/${applicationId}?error=customer_already_exists`);
  const customerId = randomUUID(); const now = new Date().toISOString();
  const { error: customerError } = await admin.from("customers").insert({ id:customerId, profile_id:application.profile_id, customer_code:`CUST-${Date.now().toString().slice(-9)}`, partner_type:"corporate", contact_name:spoc.full_name, company_name:companyName, legal_trade_name:companyName, phone:spoc.phone, email:spoc.email, address:[street,locality,city,state,postalCode].filter(Boolean).join(", "), address_street:street, address_locality:locality, india_location_id:locationId, city, state, postal_code:postalCode, pan_number:pan, is_gst_registered:Boolean(gst), gst_number:gst, fleet_size_band:fleet, onboarding_status:"active", onboarding_completed_at:now, created_by:reviewer.id, updated_by:reviewer.id });
  if (customerError) redirect(`/customers/applications/${applicationId}?error=customer_create_failed`);
  const memberships = (contacts??[]).map((contact)=>({ customer_id:customerId, profile_id:contact.phone===spoc.phone?application.profile_id:null, invited_phone:contact.phone, invited_email:contact.email, membership_role:contact.contact_role, is_primary:contact.contact_role==="dedicated_spoc", status:contact.phone===spoc.phone?"active":"pending", created_by:reviewer.id }));
  const { error: membershipError } = await admin.from("customer_memberships").insert(memberships);
  if (membershipError) { await admin.from("customers").delete().eq("id",customerId); redirect(`/customers/applications/${applicationId}?error=membership_create_failed`); }
  const copiedPaths:string[]=[]; const permanent:Record<string,unknown>[]=[];
  for (const document of documents??[]) { const download=await admin.storage.from(document.storage_bucket).download(document.storage_path); if(download.error||!download.data) redirect(`/customers/applications/${applicationId}?error=document_copy_failed`); const path=`${customerId}/${document.document_type}/${randomUUID()}.${extension(document)}`; const upload=await admin.storage.from("customer-documents").upload(path,new Uint8Array(await download.data.arrayBuffer()),{contentType:document.mime_type??"application/octet-stream",upsert:false}); if(upload.error) redirect(`/customers/applications/${applicationId}?error=document_copy_failed`); copiedPaths.push(path); permanent.push({customer_id:customerId,document_type:document.document_type,file_name:document.file_name,storage_bucket:"customer-documents",storage_path:path,mime_type:document.mime_type,file_size:document.file_size,verification_status:"verified",upload_source:"customer_app",uploaded_by:application.profile_id,verified_by:reviewer.id,verified_at:now}); }
  if(permanent.length){const result=await admin.from("customer_documents").insert(permanent);if(result.error){await admin.storage.from("customer-documents").remove(copiedPaths);await admin.from("customers").delete().eq("id",customerId);redirect(`/customers/applications/${applicationId}?error=document_records_failed`);}}
  await admin.from("customer_onboarding_contacts").update({membership_status:"pending",updated_at:now}).eq("application_id",applicationId);
  await admin.from("customer_onboarding_contacts").update({linked_profile_id:application.profile_id,membership_status:"active",updated_at:now}).eq("application_id",applicationId).eq("contact_role","dedicated_spoc");
  await admin.from("customer_onboarding_documents").update({verification_status:"verified",verified_by:reviewer.id,verified_at:now,rejection_reason:null}).eq("application_id",applicationId);
  await approvePortalOnboardingApplication(admin,applicationId,customerId,reviewer.id);
  revalidatePath("/customers"); revalidatePath("/customers/applications");
  redirect(`/customers/${customerId}/edit?success=corporate_kyc_approved`);
}
function value(data:FormData,name:string){const item=data.get(name);return typeof item==="string"&&item.trim()?item.trim():null;} function text(input:unknown){return typeof input==="string"&&input.trim()?input.trim():null;} function extension(document:Document){if(document.mime_type==="application/pdf")return"pdf";if(document.mime_type==="image/png")return"png";return"jpg";}
