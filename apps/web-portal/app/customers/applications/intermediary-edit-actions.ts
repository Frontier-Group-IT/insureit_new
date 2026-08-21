"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateExistingIntermediaryMigrationDetails } from "@/app/intermediaries/applications/[id]/existing-intermediary-migration-actions";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DOCUMENT_BUCKET="customer-documents";
const MAX_FILE_SIZE=5*1024*1024;
const ALLOWED_FILE_TYPES=new Set(["application/pdf","image/jpeg","image/png"]);
const EDUCATION_TYPES=new Set(["education_10th_marksheet","education_12th_marksheet","education_graduation_marksheet","education_post_graduation_marksheet"]);
const DOCUMENT_FIELDS=["aadhaar_front","aadhaar_back","pan_copy","cancelled_cheque","photograph","gst_copy"] as const;
const REQUIRED_DOCUMENT_FIELDS=["aadhaar_front","aadhaar_back","pan_copy","cancelled_cheque"] as const;
const PAN=/^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC=/^[A-Z]{4}0[A-Z0-9]{6}$/;
const GST=/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME=/^[A-Za-z ]+$/;
const path=(id:string)=>`/intermediaries/applications/${id}/workflow`;

type EditableProfile={id:string;partner_type:"posp"|"misp";workflow_stage:"pre_iib"|"iib_processing"|"training"|"completed";associate_employee_id:string|null;associate_profile_id:string|null;external_onboarding_id:string|null;bank_id:string|null;bank_name:string|null;aadhaar_last_four:string|null;aadhaar_hash:string|null;aadhaar_number_encrypted:string|null;dp_aadhaar_last_four:string|null;dp_aadhaar_hash:string|null;dp_aadhaar_number_encrypted:string|null};
type EditableApplication={id:string;requested_type:"posp"|"misp";status:string;partner_status:string|null;draft_data:Record<string,unknown>|null;partner_record_id:string|null};
type PartnerReviewApplication={id:string;partner_record_id:string|null;draft_data:Record<string,unknown>|null};

export async function updateIntermediaryApplication(data:FormData){
 const applicationId=value(data,"application_id");if(!applicationId)redirect("/customers/posp-misp");const submitIntent=value(data,"submit_intent")==="exit"?"exit":"documents";const reviewer=await requireScopedPospMispManager(applicationId);if(!reviewer?.id)redirect("/customers/posp-misp");
 const admin=createSupabaseAdminClient();
 const [{data:application},{data:profile}]=await Promise.all([
  admin.from("intermediary_onboarding_applications").select("id,requested_type,status,partner_status,draft_data,partner_record_id").eq("id",applicationId).maybeSingle<EditableApplication>(),
  admin.from("posp_misp_onboarding_profiles").select("id,partner_type,workflow_stage,associate_employee_id,associate_profile_id,external_onboarding_id,bank_id,bank_name,aadhaar_last_four,aadhaar_hash,aadhaar_number_encrypted,dp_aadhaar_last_four,dp_aadhaar_hash,dp_aadhaar_number_encrypted").eq("application_id",applicationId).maybeSingle<EditableProfile>()
 ]);
 const activePartnerAccount=application?.partner_status==="active_partner";
 const editableStatus=Boolean(application&&(["submitted","under_review","changes_requested"].includes(application.status)||activePartnerAccount));
 if(!application||!profile||!editableStatus)redirectFresh(`${path(applicationId)}?error=posp_misp_edit_locked`);
 const hasExistingMigration=value(data,"existing_migration_present")==="true";
 if(hasExistingMigration){const originalOnboarding=value(data,"legacy_original_onboarding_date");const originalActivation=value(data,"legacy_original_activation_date");if(originalOnboarding&&originalActivation&&originalActivation<originalOnboarding)redirectFresh(`${path(applicationId)}?error=posp_misp_edit_invalid&field=legacy_original_activation_date&stage=primary`)}

 const editSection=value(data,"edit_section")??"primary";
 if(editSection==="documents"){
  if(profile.workflow_stage!=="iib_processing"&&!activePartnerAccount)redirectFresh(`${path(applicationId)}?error=stage_locked`);
  const {data:existingRows}=await admin.from("intermediary_onboarding_documents").select("document_type").eq("application_id",applicationId).returns<Array<{document_type:string}>>();
  const resultingTypes=new Set((existingRows??[]).map(row=>row.document_type));
  const marksheet=file(data,"education_marksheet");const marksheetType=value(data,"education_document_type");
  if(marksheet&&(!marksheetType||!EDUCATION_TYPES.has(marksheetType)))redirectFresh(`${path(applicationId)}?error=posp_misp_marksheet_type_required&stage=documents`);
  if(marksheet&&marksheetType)resultingTypes.add(marksheetType);
  for(const documentType of DOCUMENT_FIELDS){if(file(data,documentType))resultingTypes.add(documentType)}
  const {data:fullProfile}=await admin.from("posp_misp_onboarding_profiles").select("gst_number").eq("id",profile.id).maybeSingle<{gst_number:string|null}>();
  const required=[...REQUIRED_DOCUMENT_FIELDS,...(fullProfile?.gst_number?["gst_copy" as const]:[])];
  const missingStandard=required.find(type=>!resultingTypes.has(type));
  if(missingStandard)redirectFresh(`${path(applicationId)}?error=documents_incomplete&stage=documents`);
  for(const documentType of DOCUMENT_FIELDS){const selected=file(data,documentType);if(selected)await replaceDocument(admin,applicationId,documentType,selected,reviewer.id)}
  if(marksheet&&marksheetType){await replaceDocument(admin,applicationId,marksheetType,marksheet,reviewer.id);const{data:others}=await admin.from("intermediary_onboarding_documents").select("id,storage_bucket,storage_path").eq("application_id",applicationId).in("document_type",[...EDUCATION_TYPES]).neq("document_type",marksheetType).returns<Array<{id:string;storage_bucket:string;storage_path:string}>>();for(const document of others??[]){await admin.from("intermediary_onboarding_documents").delete().eq("id",document.id);await removeStorageObjectIfUnreferenced(admin,document.storage_bucket,document.storage_path)}await admin.from("posp_misp_onboarding_profiles").update({education_status:"received",updated_by:reviewer.id,updated_at:new Date().toISOString()}).eq("id",profile.id)}
  revalidatePath(path(applicationId));revalidatePath(`/intermediaries/applications/${applicationId}`);redirectFresh(`${path(applicationId)}?success=documents_saved&stage=documents`);
 }

 const type=profile.partner_type;const phoneField=type==="misp"?"dp_phone":"applicant_phone";const emailField=type==="misp"?"dp_email":"applicant_email";const applicantPhone=normalizePhone(value(data,phoneField));const applicantEmail=value(data,emailField)?.toLowerCase()??null;const mispName=type==="misp"?value(data,"misp_name"):null;const businessPan=compact(value(data,"pan_number"));
 const posFirst=type==="posp"?cleanName(value(data,"pos_first_name")):null;const posMiddle=type==="posp"?cleanName(value(data,"pos_middle_name")):null;const posLast=type==="posp"?cleanName(value(data,"pos_last_name")):null;const posName=type==="posp"?[posFirst,posMiddle,posLast].filter(Boolean).join(" ")||null:null;
 const dpFirst=type==="misp"?cleanName(value(data,"dp_first_name")):null;const dpMiddle=type==="misp"?cleanName(value(data,"dp_middle_name")):null;const dpLast=type==="misp"?cleanName(value(data,"dp_last_name")):null;const dpName=[dpFirst,dpMiddle,dpLast].filter(Boolean).join(" ")||null;const dpPan=type==="misp"?compact(value(data,"dp_pan_number")):null;
 const dob=value(data,"date_of_birth");
 if(!applicantPhone)redirectField(applicationId,phoneField);
 if(!applicantEmail||!EMAIL.test(applicantEmail))redirectField(applicationId,emailField);
 if(!dob||Number.isNaN(Date.parse(dob)))redirectField(applicationId,"date_of_birth");
 if(!businessPan||!PAN.test(businessPan))redirectField(applicationId,"pan_number");
 if(!value(data,"address"))redirectField(applicationId,"address",true);
 if(!value(data,"city"))redirectField(applicationId,"city",true);
 if(!value(data,"state"))redirectField(applicationId,"state",true);
 if(!/^[0-9]{6}$/.test(value(data,"postal_code")??""))redirectField(applicationId,"postal_code");
 if(type==="posp"&&(!validName(posFirst)||!validName(posLast)||(posMiddle&&!validName(posMiddle))))redirectFresh(`${path(applicationId)}?error=posp_misp_edit_invalid&stage=primary`);
 if(type==="misp"&&(!mispName||!validName(dpFirst)||!validName(dpLast)||(dpMiddle&&!validName(dpMiddle))))redirectFresh(`${path(applicationId)}?error=posp_misp_edit_invalid&stage=primary`);
 if(type==="misp"&&(!dpPan||!PAN.test(dpPan)))redirectField(applicationId,"dp_pan_number");
 const account=value(data,"bank_account_number")?.replace(/\D/g,"")??"";const ifsc=compact(value(data,"bank_ifsc_code"));const gst=compact(value(data,"gst_number"));
 if(!/^[0-9]{6,20}$/.test(account))redirectField(applicationId,"bank_account_number");
 if(!IFSC.test(ifsc??""))redirectField(applicationId,"bank_ifsc_code");
 if((type==="misp"&&!gst)||(gst&&!GST.test(gst)))redirectField(applicationId,"gst_number");
 const aadhaarDigits=value(data,"aadhaar_number")?.replace(/\D/g,"")??"";if(aadhaarDigits&&!/^[0-9]{12}$/.test(aadhaarDigits))redirectFresh(`${path(applicationId)}?error=posp_misp_aadhaar_invalid&field=aadhaar_number&stage=primary`);
 const existingAadhaar=type==="misp"?{lastFour:profile.dp_aadhaar_last_four,hash:profile.dp_aadhaar_hash,encrypted:profile.dp_aadhaar_number_encrypted}:{lastFour:profile.aadhaar_last_four,hash:profile.aadhaar_hash,encrypted:profile.aadhaar_number_encrypted};if(!aadhaarDigits&&!existingAadhaar.encrypted)redirectFresh(`${path(applicationId)}?error=posp_misp_aadhaar_invalid&field=aadhaar_number&stage=primary`);
 const associates=await loadPospMispAssociates(admin);const submittedAssociate=value(data,"associate_employee_id");const associate=associates.find(row=>row.id===submittedAssociate||row.profile_id===submittedAssociate)??associates.find(row=>row.id===profile.associate_employee_id||row.profile_id===profile.associate_profile_id);const bankId=value(data,"bank_id")??profile.bank_id;const{data:bank}=bankId?await admin.from("banks").select("id,name").eq("id",bankId).maybeSingle<{id:string;name:string}>():{data:null};const submittedOem=type==="misp"?value(data,"oem_name"):null;const{data:oemBrand}=type==="misp"&&submittedOem?await admin.from("vehicle_manufacturer_brands").select("brand_name,manufacturer_id").eq("brand_name",submittedOem).eq("is_active",true).maybeSingle<{brand_name:string;manufacturer_id:string}>():{data:null};const{data:oemManufacturer}=oemBrand?await admin.from("vehicle_manufacturers").select("id").eq("id",oemBrand.manufacturer_id).eq("is_active",true).maybeSingle<{id:string}>():{data:null};if(!associate||!bank)redirectFresh(`${path(applicationId)}?error=posp_misp_edit_invalid&stage=primary`);if(type==="misp"&&(!oemBrand||!oemManufacturer))redirectField(applicationId,"oem_name");
 const aadhaar=aadhaarDigits?{lastFour:aadhaarDigits.slice(-4),hash:createHash("sha256").update(aadhaarDigits).digest("hex"),encrypted:encryptSensitiveValue(aadhaarDigits)}:existingAadhaar;
 const storedExternalId=profile.external_onboarding_id?.startsWith("PENDING-")?profile.external_onboarding_id:(value(data,"external_onboarding_id")??profile.external_onboarding_id);const update={associate_employee_id:associate.id,associate_profile_id:associate.profile_id,associate_name:associate.full_name,associate_id:associate.employee_code,external_onboarding_id:storedExternalId,document_received_at:value(data,"document_received_at"),pos_first_name:posFirst,pos_middle_name:posMiddle,pos_last_name:posLast,pos_name:posName,misp_name:mispName,applicant_phone:applicantPhone,applicant_email:applicantEmail,pan_number:businessPan,gst_number:gst,address:value(data,"address"),city:value(data,"city"),state:value(data,"state"),postal_code:value(data,"postal_code"),bank_id:bank.id,bank_name:bank.name,bank_account_number:account,bank_ifsc_code:ifsc,oem_name:type==="misp"?oemBrand?.brand_name??null:null,dp_first_name:dpFirst,dp_middle_name:dpMiddle,dp_last_name:dpLast,dp_name:dpName,dp_phone:type==="misp"?applicantPhone:null,dp_email:type==="misp"?applicantEmail:null,dp_pan_number:dpPan,dp_date_of_birth:type==="misp"?dob:null,dp_aadhaar_last_four:type==="misp"?aadhaar.lastFour:null,dp_aadhaar_hash:type==="misp"?aadhaar.hash:null,dp_aadhaar_number_encrypted:type==="misp"?aadhaar.encrypted:null,date_of_birth:type==="posp"?dob:null,aadhaar_last_four:type==="posp"?aadhaar.lastFour:null,aadhaar_hash:type==="posp"?aadhaar.hash:null,aadhaar_number_encrypted:type==="posp"?aadhaar.encrypted:null,updated_by:reviewer.id,updated_at:new Date().toISOString()};
 const{error:profileError}=await admin.from("posp_misp_onboarding_profiles").update(update).eq("id",profile.id);if(profileError)redirectFresh(profileErrorPath(applicationId,profileError.message));
 if(!gst){const{data:gstDocuments}=await admin.from("intermediary_onboarding_documents").select("id,storage_bucket,storage_path").eq("application_id",applicationId).eq("document_type","gst_copy").returns<Array<{id:string;storage_bucket:string;storage_path:string}>>();for(const document of gstDocuments??[]){await admin.from("intermediary_onboarding_documents").delete().eq("id",document.id);await removeStorageObjectIfUnreferenced(admin,document.storage_bucket,document.storage_path)}}
 const draft={...(application.draft_data??{}),...update,gst_registered:Boolean(gst),bank_account_number:undefined,bank_account_last_four:account.slice(-4),aadhaar_hash:undefined,aadhaar_number_encrypted:undefined,dp_aadhaar_hash:undefined,dp_aadhaar_number_encrypted:undefined,updated_by:undefined};const{error:appError}=await admin.from("intermediary_onboarding_applications").update({applicant_phone:applicantPhone,applicant_email:applicantEmail,draft_data:draft,updated_at:new Date().toISOString()}).eq("id",applicationId);if(appError)redirectFresh(`${path(applicationId)}?error=posp_misp_edit_failed&stage=primary`);
 await admin.from("intermediary_onboarding_contacts").delete().eq("application_id",applicationId);const{error:contactError}=await admin.from("intermediary_onboarding_contacts").insert({application_id:applicationId,contact_role:type==="misp"?"misp_dp":"posp",full_name:type==="misp"?dpName:posName,phone:applicantPhone,email:applicantEmail,is_designated_person:type==="misp",login_required:false,membership_status:"pending"});if(contactError)redirectFresh(`${path(applicationId)}?error=posp_misp_edit_failed&stage=primary`);
 const now=new Date().toISOString();
 if(profile.workflow_stage==="pre_iib"){
  const{data:advanced,error:advanceError}=await admin.from("posp_misp_onboarding_profiles").update({workflow_stage:"iib_processing",requested_account_type:type,final_account_type:type,pre_iib_submitted_at:now,updated_by:reviewer.id,updated_at:now}).eq("id",profile.id).eq("workflow_stage","pre_iib").select("id").maybeSingle<{id:string}>();
  if(advanceError||!advanced)redirectFresh(`${path(applicationId)}?error=workflow_save_failed&stage=primary`);
  await admin.from("intermediary_onboarding_applications").update({final_type:type,registration_status:"documents_pending",updated_at:now}).eq("id",applicationId);
 }
 if(hasExistingMigration){const migrationState=await updateExistingIntermediaryMigrationDetails({ok:true,message:""},data);if(!migrationState.ok){const params=new URLSearchParams({error:"posp_misp_edit_failed",migration_error:migrationState.message||errorsFallback(),stage:"primary"});redirectFresh(`${path(applicationId)}?${params.toString()}`)}}
 revalidatePath(path(applicationId));revalidatePath(`/intermediaries/applications/${applicationId}`);
 if(submitIntent==="exit"){
  const partnerApplicationId=await resolvePartnerReviewApplicationId(admin,application);
  revalidatePath(`/intermediaries/applications/${partnerApplicationId}`);
  redirectFresh(`/intermediaries/applications/${partnerApplicationId}?success=primary_details_saved`);
 }
 redirectFresh(`${path(applicationId)}?success=primary_details_saved&stage=documents`);
}

async function resolvePartnerReviewApplicationId(admin:ReturnType<typeof createSupabaseAdminClient>,application:EditableApplication){
 if(accountContext(application.draft_data)==="partner")return application.id;
 const parentApplicationId=plainText(application.draft_data?.parent_partner_application_id);
 if(parentApplicationId){
  const{data:parent}=await admin.from("intermediary_onboarding_applications").select("id,partner_record_id,draft_data").eq("id",parentApplicationId).maybeSingle<PartnerReviewApplication>();
  if(parent&&accountContext(parent.draft_data)==="partner"&&(!application.partner_record_id||parent.partner_record_id===application.partner_record_id))return parent.id;
 }
 if(application.partner_record_id){
  const{data:related}=await admin.from("intermediary_onboarding_applications").select("id,partner_record_id,draft_data").eq("partner_record_id",application.partner_record_id).returns<PartnerReviewApplication[]>();
  const partner=(related??[]).find(item=>accountContext(item.draft_data)==="partner");
  if(partner)return partner.id;
 }
 return application.id;
}
function accountContext(draft:Record<string,unknown>|null|undefined){const context=draft?.account_context;return context==="posp"||context==="misp"?context:"partner"}
function plainText(input:unknown){return typeof input==="string"&&input.trim()?input.trim():null}

async function replaceDocument(admin:ReturnType<typeof createSupabaseAdminClient>,applicationId:string,documentType:string,selected:File,uploadedBy:string){if(!ALLOWED_FILE_TYPES.has(selected.type)||selected.size>MAX_FILE_SIZE)redirectFresh(`${path(applicationId)}?error=posp_misp_document_invalid&stage=documents`);const{data:previous}=await admin.from("intermediary_onboarding_documents").select("storage_bucket,storage_path").eq("application_id",applicationId).eq("document_type",documentType).maybeSingle<{storage_bucket:string;storage_path:string}>();const extension=selected.type==="application/pdf"?"pdf":selected.type==="image/png"?"png":"jpg";const storagePath=`${applicationId}/intermediary/${documentType}/${randomUUID()}.${extension}`;const{error:uploadError}=await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath,new Uint8Array(await selected.arrayBuffer()),{contentType:selected.type,upsert:false});if(uploadError)redirectFresh(`${path(applicationId)}?error=posp_misp_document_failed&stage=documents`);const{error:recordError}=await admin.from("intermediary_onboarding_documents").upsert({application_id:applicationId,document_type:documentType,file_name:selected.name,storage_bucket:DOCUMENT_BUCKET,storage_path:storagePath,mime_type:selected.type,file_size:selected.size,verification_status:"pending",uploaded_by:uploadedBy},{onConflict:"application_id,document_type"});if(recordError){await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);redirectFresh(`${path(applicationId)}?error=posp_misp_document_failed&stage=documents`)}if(previous?.storage_path&&previous.storage_path!==storagePath)await removeStorageObjectIfUnreferenced(admin,previous.storage_bucket,previous.storage_path)}
async function removeStorageObjectIfUnreferenced(admin:ReturnType<typeof createSupabaseAdminClient>,bucket:string,storagePath:string){const{count}=await admin.from("intermediary_onboarding_documents").select("id",{count:"exact",head:true}).eq("storage_bucket",bucket).eq("storage_path",storagePath);if(!count)await admin.storage.from(bucket).remove([storagePath])}
function profileErrorPath(applicationId:string,message:string){const lower=message.toLowerCase();if(lower.includes("partner_aadhaar")||lower.includes("aadhaar_uidx")||lower.includes("duplicate")&&lower.includes("aadhaar"))return`${path(applicationId)}?error=duplicate_aadhaar&field=aadhaar_number&stage=primary`;if(lower.includes("pan_uidx")||lower.includes("duplicate")&&lower.includes("pan"))return`${path(applicationId)}?error=duplicate_pan&field=pan_number&stage=primary`;if(lower.includes("duplicate")&&lower.includes("email"))return`${path(applicationId)}?error=duplicate_email&field=applicant_email&stage=primary`;if(lower.includes("duplicate")&&(lower.includes("mobile")||lower.includes("phone")))return`${path(applicationId)}?error=duplicate_mobile&field=applicant_phone&stage=primary`;return`${path(applicationId)}?error=posp_misp_edit_failed&stage=primary`}
function errorsFallback(){return "The primary information could not be saved."}
function redirectField(applicationId:string,field:string,required=false):never{redirectFresh(`${path(applicationId)}?error=${required?"field_required":"field_format_invalid"}&field=${encodeURIComponent(field)}&stage=primary`)}
function redirectFresh(href:string):never{redirect(href)}
function value(data:FormData,key:string){const item=data.get(key);return typeof item==="string"&&item.trim()?item.trim():null}
function compact(input:string|null){return input?.replace(/\s/g,"").toUpperCase()??null}
function file(data:FormData,key:string){const item=data.get(key);return item instanceof File&&item.size>0?item:null}
function normalizePhone(input:string|null){let digits=input?.replace(/\D/g,"")??"";if(digits.length>10&&digits.startsWith("91"))digits=digits.slice(-10);return /^[6-9][0-9]{9}$/.test(digits)?`+91${digits}`:null}
function cleanName(input:string|null){return input?.trim().replace(/\s+/g," ")??null}
function validName(input:string|null){return Boolean(input&&NAME.test(input))}