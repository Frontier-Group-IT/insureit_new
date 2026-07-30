"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DOCUMENT_BUCKET="customer-documents";
const MAX_FILE_SIZE=5*1024*1024;
const ALLOWED_FILE_TYPES=new Set(["application/pdf","image/jpeg","image/png"]);
const EDUCATION_TYPES=new Set(["education_10th_marksheet","education_12th_marksheet","education_graduation_marksheet","education_post_graduation_marksheet"]);
const DOCUMENT_FIELDS=["aadhaar_front","aadhaar_back","pan_copy","cancelled_cheque","photograph","gst_copy","agreement_copy"] as const;
const PAN=/^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC=/^[A-Z]{4}0[A-Z0-9]{6}$/;
const NAME=/^[A-Za-z ]+$/;
const path=(id:string)=>`/intermediaries/applications/${id}/workflow`;

type EditableProfile={id:string;partner_type:"posp"|"misp";workflow_stage:"pre_iib"|"iib_processing"|"training"|"completed";associate_employee_id:string|null;associate_profile_id:string|null;external_onboarding_id:string|null;bank_id:string|null;bank_name:string|null;aadhaar_last_four:string|null;aadhaar_hash:string|null;aadhaar_number_encrypted:string|null;dp_aadhaar_last_four:string|null;dp_aadhaar_hash:string|null;dp_aadhaar_number_encrypted:string|null};

export async function updateIntermediaryApplication(data:FormData){
 const reviewer=await requirePospMispManager();const applicationId=value(data,"application_id");if(!applicationId||!reviewer?.id)redirect("/customers/posp-misp");
 const admin=createSupabaseAdminClient();
 const [{data:application},{data:profile}]=await Promise.all([
  admin.from("intermediary_onboarding_applications").select("id,requested_type,status,draft_data").eq("id",applicationId).maybeSingle<{id:string;requested_type:"posp"|"misp";status:string;draft_data:Record<string,unknown>|null}>(),
  admin.from("posp_misp_onboarding_profiles").select("id,partner_type,workflow_stage,associate_employee_id,associate_profile_id,external_onboarding_id,bank_id,bank_name,aadhaar_last_four,aadhaar_hash,aadhaar_number_encrypted,dp_aadhaar_last_four,dp_aadhaar_hash,dp_aadhaar_number_encrypted").eq("application_id",applicationId).maybeSingle<EditableProfile>()
 ]);
 if(!application||!profile||!["submitted","under_review","changes_requested"].includes(application.status))redirect(`${path(applicationId)}?error=posp_misp_edit_locked`);

 const editSection=value(data,"edit_section")??"primary";
 if(editSection==="documents"){
  if(profile.workflow_stage!=="iib_processing")redirect(`${path(applicationId)}?error=stage_locked`);
  const {data:existingRows}=await admin.from("intermediary_onboarding_documents").select("document_type").eq("application_id",applicationId).returns<Array<{document_type:string}>>();
  const resultingTypes=new Set((existingRows??[]).map(row=>row.document_type));
  const marksheet=file(data,"education_marksheet");const marksheetType=value(data,"education_document_type");
  if(marksheet&&(!marksheetType||!EDUCATION_TYPES.has(marksheetType)))redirect(`${path(applicationId)}?error=posp_misp_marksheet_type_required&stage=documents`);
  if(marksheet&&marksheetType)resultingTypes.add(marksheetType);
  for(const documentType of DOCUMENT_FIELDS){if(file(data,documentType))resultingTypes.add(documentType)}
  const hasEducation=[...EDUCATION_TYPES].some(type=>resultingTypes.has(type));
  const missingStandard=DOCUMENT_FIELDS.find(type=>!resultingTypes.has(type));
  if(!hasEducation||missingStandard)redirect(`${path(applicationId)}?error=documents_incomplete&stage=documents`);
  for(const documentType of DOCUMENT_FIELDS){const selected=file(data,documentType);if(selected)await replaceDocument(admin,applicationId,documentType,selected,reviewer.id)}
  if(marksheet&&marksheetType){await replaceDocument(admin,applicationId,marksheetType,marksheet,reviewer.id);const{data:others}=await admin.from("intermediary_onboarding_documents").select("id,storage_bucket,storage_path").eq("application_id",applicationId).in("document_type",[...EDUCATION_TYPES]).neq("document_type",marksheetType).returns<Array<{id:string;storage_bucket:string;storage_path:string}>>();for(const document of others??[]){await admin.from("intermediary_onboarding_documents").delete().eq("id",document.id);await removeStorageObjectIfUnreferenced(admin,document.storage_bucket,document.storage_path)}await admin.from("posp_misp_onboarding_profiles").update({education_status:"received",updated_by:reviewer.id,updated_at:new Date().toISOString()}).eq("id",profile.id)}
  revalidatePath(path(applicationId));redirect(`${path(applicationId)}?success=documents_saved&stage=documents`);
 }

 const type=profile.partner_type;const applicantPhone=normalizePhone(value(data,type==="misp"?"dp_phone":"applicant_phone"));const applicantEmail=value(data,type==="misp"?"dp_email":"applicant_email")?.toLowerCase()??null;const mispName=type==="misp"?value(data,"misp_name"):null;const businessPan=compact(value(data,"pan_number"));
 const posFirst=type==="posp"?cleanName(value(data,"pos_first_name")):null;const posMiddle=type==="posp"?cleanName(value(data,"pos_middle_name")):null;const posLast=type==="posp"?cleanName(value(data,"pos_last_name")):null;const posName=type==="posp"?[posFirst,posMiddle,posLast].filter(Boolean).join(" ")||null:null;
 const dpFirst=type==="misp"?cleanName(value(data,"dp_first_name")):null;const dpMiddle=type==="misp"?cleanName(value(data,"dp_middle_name")):null;const dpLast=type==="misp"?cleanName(value(data,"dp_last_name")):null;const dpName=[dpFirst,dpMiddle,dpLast].filter(Boolean).join(" ")||null;const dpPan=type==="misp"?compact(value(data,"dp_pan_number")):null;
 const dob=value(data,"date_of_birth");
 if(!applicantPhone||!applicantEmail||!dob||Number.isNaN(Date.parse(dob))||!businessPan||!PAN.test(businessPan)||!value(data,"address")||!value(data,"city")||!value(data,"state")||!/^[0-9]{6}$/.test(value(data,"postal_code")??""))redirect(`${path(applicationId)}?error=posp_misp_edit_invalid&stage=primary`);
 if(type==="posp"&&(!validName(posFirst)||!validName(posLast)||(posMiddle&&!validName(posMiddle))))redirect(`${path(applicationId)}?error=posp_misp_edit_invalid&stage=primary`);
 if(type==="misp"&&(!mispName||!validName(dpFirst)||!validName(dpLast)||(dpMiddle&&!validName(dpMiddle))||!dpPan||!PAN.test(dpPan)))redirect(`${path(applicationId)}?error=posp_misp_edit_invalid&stage=primary`);
 const account=value(data,"bank_account_number")?.replace(/\D/g,"")??"";const ifsc=compact(value(data,"bank_ifsc_code"));if(!/^[0-9]{6,20}$/.test(account)||!IFSC.test(ifsc??""))redirect(`${path(applicationId)}?error=posp_misp_edit_invalid&stage=primary`);
 const aadhaarDigits=value(data,"aadhaar_number")?.replace(/\D/g,"")??"";if(aadhaarDigits&&!/^[0-9]{12}$/.test(aadhaarDigits))redirect(`${path(applicationId)}?error=posp_misp_aadhaar_invalid&field=aadhaar_number&stage=primary`);
 const existingAadhaar=type==="misp"?{lastFour:profile.dp_aadhaar_last_four,hash:profile.dp_aadhaar_hash,encrypted:profile.dp_aadhaar_number_encrypted}:{lastFour:profile.aadhaar_last_four,hash:profile.aadhaar_hash,encrypted:profile.aadhaar_number_encrypted};if(!aadhaarDigits&&!existingAadhaar.encrypted)redirect(`${path(applicationId)}?error=posp_misp_aadhaar_invalid&field=aadhaar_number&stage=primary`);
 const associates=await loadPospMispAssociates(admin);const submittedAssociate=value(data,"associate_employee_id");const associate=associates.find(row=>row.id===submittedAssociate||row.profile_id===submittedAssociate)??associates.find(row=>row.id===profile.associate_employee_id||row.profile_id===profile.associate_profile_id);const bankId=value(data,"bank_id")??profile.bank_id;const{data:bank}=bankId?await admin.from("banks").select("id,name").eq("id",bankId).maybeSingle<{id:string;name:string}>():{data:null};const{data:oem}=type==="misp"&&value(data,"oem_name")?await admin.from("vehicle_manufacturers").select("name").eq("name",value(data,"oem_name")!).eq("is_active",true).maybeSingle<{name:string}>():{data:null};if(!associate||!bank||(type==="misp"&&!oem))redirect(`${path(applicationId)}?error=posp_misp_edit_invalid&stage=primary`);
 const aadhaar=aadhaarDigits?{lastFour:aadhaarDigits.slice(-4),hash:createHash("sha256").update(aadhaarDigits).digest("hex"),encrypted:encryptSensitiveValue(aadhaarDigits)}:existingAadhaar;
 const storedExternalId=profile.external_onboarding_id?.startsWith("PENDING-")?profile.external_onboarding_id:(value(data,"external_onboarding_id")??profile.external_onboarding_id);const update={associate_employee_id:associate.id,associate_profile_id:associate.profile_id,associate_name:associate.full_name,associate_id:associate.employee_code,external_onboarding_id:storedExternalId,document_received_at:value(data,"document_received_at"),pos_first_name:posFirst,pos_middle_name:posMiddle,pos_last_name:posLast,pos_name:posName,misp_name:mispName,applicant_phone:applicantPhone,applicant_email:applicantEmail,pan_number:businessPan,gst_number:compact(value(data,"gst_number")),address:value(data,"address"),city:value(data,"city"),state:value(data,"state"),postal_code:value(data,"postal_code"),bank_id:bank.id,bank_name:bank.name,bank_account_number:account,bank_ifsc_code:ifsc,oem_name:type==="misp"?oem?.name??null:null,dp_first_name:dpFirst,dp_middle_name:dpMiddle,dp_last_name:dpLast,dp_name:dpName,dp_phone:type==="misp"?applicantPhone:null,dp_email:type==="misp"?applicantEmail:null,dp_pan_number:dpPan,dp_date_of_birth:type==="misp"?dob:null,dp_aadhaar_last_four:type==="misp"?aadhaar.lastFour:null,dp_aadhaar_hash:type==="misp"?aadhaar.hash:null,dp_aadhaar_number_encrypted:type==="misp"?aadhaar.encrypted:null,date_of_birth:type==="posp"?dob:null,aadhaar_last_four:type==="posp"?aadhaar.lastFour:null,aadhaar_hash:type==="posp"?aadhaar.hash:null,aadhaar_number_encrypted:type==="posp"?aadhaar.encrypted:null,updated_by:reviewer.id,updated_at:new Date().toISOString()};
 const{error:profileError}=await admin.from("posp_misp_onboarding_profiles").update(update).eq("id",profile.id);if(profileError)redirect(profileErrorPath(applicationId,profileError.message));
 const draft={...(application.draft_data??{}),...update,bank_account_number:undefined,bank_account_last_four:account.slice(-4),aadhaar_hash:undefined,aadhaar_number_encrypted:undefined,dp_aadhaar_hash:undefined,dp_aadhaar_number_encrypted:undefined,updated_by:undefined};const{error:appError}=await admin.from("intermediary_onboarding_applications").update({applicant_phone:applicantPhone,applicant_email:applicantEmail,draft_data:draft,updated_at:new Date().toISOString()}).eq("id",applicationId);if(appError)redirect(`${path(applicationId)}?error=posp_misp_edit_failed&stage=primary`);
 await admin.from("intermediary_onboarding_contacts").delete().eq("application_id",applicationId);const{error:contactError}=await admin.from("intermediary_onboarding_contacts").insert({application_id:applicationId,contact_role:type==="misp"?"misp_dp":"posp",full_name:type==="misp"?dpName:posName,phone:applicantPhone,email:applicantEmail,is_designated_person:type==="misp",login_required:false,membership_status:"pending"});if(contactError)redirect(`${path(applicationId)}?error=posp_misp_edit_failed&stage=primary`);
 const now=new Date().toISOString();
 if(profile.workflow_stage==="pre_iib"){
  const{data:advanced,error:advanceError}=await admin.from("posp_misp_onboarding_profiles").update({workflow_stage:"iib_processing",requested_account_type:type,final_account_type:type,pre_iib_submitted_at:now,updated_by:reviewer.id,updated_at:now}).eq("id",profile.id).eq("workflow_stage","pre_iib").select("id").maybeSingle<{id:string}>();
  if(advanceError||!advanced)redirect(`${path(applicationId)}?error=workflow_save_failed&stage=primary`);
  await admin.from("intermediary_onboarding_applications").update({final_type:type,registration_status:"documents_pending",updated_at:now}).eq("id",applicationId);
 }
 revalidatePath(path(applicationId));redirect(`${path(applicationId)}?success=primary_details_saved&stage=documents`);
}

async function replaceDocument(admin:ReturnType<typeof createSupabaseAdminClient>,applicationId:string,documentType:string,selected:File,uploadedBy:string){if(!ALLOWED_FILE_TYPES.has(selected.type)||selected.size>MAX_FILE_SIZE)redirect(`${path(applicationId)}?error=posp_misp_document_invalid&stage=documents`);const{data:previous}=await admin.from("intermediary_onboarding_documents").select("storage_bucket,storage_path").eq("application_id",applicationId).eq("document_type",documentType).maybeSingle<{storage_bucket:string;storage_path:string}>();const extension=selected.type==="application/pdf"?"pdf":selected.type==="image/png"?"png":"jpg";const storagePath=`${applicationId}/intermediary/${documentType}/${randomUUID()}.${extension}`;const{error:uploadError}=await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath,new Uint8Array(await selected.arrayBuffer()),{contentType:selected.type,upsert:false});if(uploadError)redirect(`${path(applicationId)}?error=posp_misp_document_failed&stage=documents`);const{error:recordError}=await admin.from("intermediary_onboarding_documents").upsert({application_id:applicationId,document_type:documentType,file_name:selected.name,storage_bucket:DOCUMENT_BUCKET,storage_path:storagePath,mime_type:selected.type,file_size:selected.size,verification_status:"pending",uploaded_by:uploadedBy},{onConflict:"application_id,document_type"});if(recordError){await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);redirect(`${path(applicationId)}?error=posp_misp_document_failed&stage=documents`)}if(previous?.storage_path&&previous.storage_path!==storagePath)await removeStorageObjectIfUnreferenced(admin,previous.storage_bucket,previous.storage_path)}
async function removeStorageObjectIfUnreferenced(admin:ReturnType<typeof createSupabaseAdminClient>,bucket:string,storagePath:string){const{count}=await admin.from("intermediary_onboarding_documents").select("id",{count:"exact",head:true}).eq("storage_bucket",bucket).eq("storage_path",storagePath);if(!count)await admin.storage.from(bucket).remove([storagePath])}
function profileErrorPath(applicationId:string,message:string){const lower=message.toLowerCase();if(lower.includes("partner_aadhaar")||lower.includes("aadhaar_uidx")||lower.includes("duplicate")&&lower.includes("aadhaar"))return`${path(applicationId)}?error=duplicate_aadhaar&field=aadhaar_number&stage=primary`;if(lower.includes("pan_uidx")||lower.includes("duplicate")&&lower.includes("pan"))return`${path(applicationId)}?error=duplicate_pan&field=pan_number&stage=primary`;if(lower.includes("duplicate")&&lower.includes("email"))return`${path(applicationId)}?error=duplicate_email&field=applicant_email&stage=primary`;if(lower.includes("duplicate")&&(lower.includes("mobile")||lower.includes("phone")))return`${path(applicationId)}?error=duplicate_mobile&field=applicant_phone&stage=primary`;return`${path(applicationId)}?error=posp_misp_edit_failed&stage=primary`}
function value(data:FormData,key:string){const item=data.get(key);return typeof item==="string"&&item.trim()?item.trim():null}
function compact(input:string|null){return input?.replace(/\s/g,"").toUpperCase()??null}
function file(data:FormData,key:string){const item=data.get(key);return item instanceof File&&item.size>0?item:null}
function normalizePhone(input:string|null){let digits=input?.replace(/\D/g,"")??"";if(digits.length>10&&digits.startsWith("91"))digits=digits.slice(-10);return /^[6-9][0-9]{9}$/.test(digits)?`+91${digits}`:null}
function cleanName(input:string|null){return input?.trim().replace(/\s+/g," ")??null}
function validName(input:string|null){return Boolean(input&&NAME.test(input))}
