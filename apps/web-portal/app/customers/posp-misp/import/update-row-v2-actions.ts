"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const PAN=/^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC=/^[A-Z]{4}0[A-Z0-9]{6}$/;
const GST=/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const NAME=/^[A-Za-z ]+$/;

type PartnerType="posp"|"misp";
type ImportRow={id:string;import_batch_id:string;partner_type:PartnerType;normalized_data:Record<string,unknown>;status:string};

export async function updatePospMispImportRowV2(data:FormData){
  const manager=await currentManager();
  const batchId=value(data,"batch_id");
  const rowId=value(data,"row_id");
  if(!batchId||!rowId)redirect("/customers/posp-misp/import?error=row_missing");

  const admin=createSupabaseAdminClient();
  const{data:row,error:rowError}=await admin.from("posp_misp_import_rows").select("id,import_batch_id,partner_type,normalized_data,status").eq("id",rowId).eq("import_batch_id",batchId).maybeSingle<ImportRow>();
  if(rowError||!row)redirect(`/customers/posp-misp/import/${batchId}?error=row_missing`);
  if(["submitted","processing"].includes(row.status))redirect(`/customers/posp-misp/import/${batchId}?error=row_locked`);

  const associates=await loadPospMispAssociates(admin);
  const associateId=value(data,"associate_employee_id");
  const associate=associates.find(item=>item.id===associateId)??null;
  if(!associate)redirect(`/customers/posp-misp/import/${batchId}?error=master_data`);

  const bankId=value(data,"bank_id");
  const{data:bank}=bankId?await admin.from("banks").select("id,name").eq("id",bankId).eq("is_active",true).maybeSingle<{id:string;name:string}>():{data:null};
  if(!bank)redirect(`/customers/posp-misp/import/${batchId}?error=master_data`);

  const type=row.partner_type;
  const isMisp=type==="misp";
  const onboardingId=compactUpper(data,"external_onboarding_id");
  const businessPan=compactUpper(data,"pan_number");
  const posFirst=isMisp?null:personName(data,"pos_first_name");
  const posMiddle=isMisp?null:personName(data,"pos_middle_name");
  const posLast=isMisp?null:personName(data,"pos_last_name");
  const posName=[posFirst,posMiddle,posLast].filter(Boolean).join(" ")||null;
  const mispName=isMisp?value(data,"misp_name"):null;
  const dpFirst=isMisp?personName(data,"dp_first_name"):null;
  const dpMiddle=isMisp?personName(data,"dp_middle_name"):null;
  const dpLast=isMisp?personName(data,"dp_last_name"):null;
  const dpName=[dpFirst,dpMiddle,dpLast].filter(Boolean).join(" ")||null;
  const dpPan=isMisp?compactUpper(data,"dp_pan_number"):null;
  const phone=normalizePhone(value(data,isMisp?"dp_phone":"applicant_phone"));
  const email=value(data,isMisp?"dp_email":"applicant_email")?.toLowerCase()??null;
  const dob=value(data,isMisp?"dp_date_of_birth":"date_of_birth");
  const aadhaarDigits=onlyDigits(data,"aadhaar_number");
  const address=value(data,"address");
  const city=value(data,"city");
  const state=value(data,"state");
  const postalCode=onlyDigits(data,"postal_code");
  const accountNumber=onlyDigits(data,"bank_account_number");
  const ifsc=compactUpper(data,"bank_ifsc_code");
  const gst=compactUpper(data,"gst_number");
  const oemName=isMisp?value(data,"oem_name"):null;

  const errors:string[]=[];
  if(!onboardingId)errors.push(`${isMisp?"MISP":"POSP"} ID is required.`);
  if(!PAN.test(businessPan??""))errors.push(`${isMisp?"MISP":"POSP"} PAN is invalid.`);
  if(!isMisp&&(!posFirst||!posLast))errors.push("POS First Name and POS Last Name are required.");
  if(isMisp&&!mispName)errors.push("MISP Name is required.");
  if(isMisp&&(!dpFirst||!dpLast))errors.push("DP First Name and DP Last Name are required.");
  if(isMisp&&!PAN.test(dpPan??""))errors.push("DP PAN is invalid.");
  if(!phone)errors.push("A valid 10-digit mobile number is required.");
  if(!email||!/^\S+@\S+\.\S+$/.test(email))errors.push("A valid email address is required.");
  if(!dob||Number.isNaN(Date.parse(dob)))errors.push("A valid date of birth is required.");
  if(!/^[0-9]{12}$/.test(aadhaarDigits??""))errors.push("Aadhaar Number must contain exactly 12 digits.");
  if(!address||!city||!state)errors.push("Address, City and State are required.");
  if(!/^[0-9]{6}$/.test(postalCode??""))errors.push("PIN Code must contain exactly 6 digits.");
  if(!accountNumber||!/^[0-9]{6,20}$/.test(accountNumber))errors.push("A valid bank account number is required.");
  if(!IFSC.test(ifsc??""))errors.push("IFSC Code is invalid.");
  if(gst&&!GST.test(gst))errors.push("GST Number is invalid.");
  if(isMisp&&!oemName)errors.push("OEM Name is required.");
  for(const [label,name] of [["First Name",isMisp?dpFirst:posFirst],["Middle Name",isMisp?dpMiddle:posMiddle],["Last Name",isMisp?dpLast:posLast]] as const){if(name&&!NAME.test(name))errors.push(`${label} may contain letters and spaces only.`)}

  if(isMisp&&oemName){const{data:oem}=await admin.from("vehicle_manufacturers").select("name").eq("name",oemName).eq("is_active",true).maybeSingle<{name:string}>();if(!oem)errors.push("Select a valid OEM Name.")}
  const{data:duplicateRows}=await admin.from("posp_misp_import_rows").select("id,normalized_data").eq("import_batch_id",batchId).neq("id",rowId).returns<Array<{id:string;normalized_data:Record<string,unknown>}>>();
  if((duplicateRows??[]).some(item=>String(item.normalized_data?.external_onboarding_id??"").trim().toUpperCase()===onboardingId))errors.push("External ID is duplicated in this workbook.");

  const existing=row.normalized_data??{};
  const aadhaar={lastFour:aadhaarDigits?.slice(-4)??null,hash:aadhaarDigits?createHash("sha256").update(aadhaarDigits).digest("hex"):null,encrypted:aadhaarDigits?encryptSensitiveValue(aadhaarDigits):null};
  const normalized={
    ...existing,
    partner_type:type,
    associate_employee_id:associate.id,
    associate_profile_id:associate.profile_id,
    associate_name:associate.full_name,
    associate_id:associate.employee_code,
    external_onboarding_id:onboardingId,
    document_received_at:value(data,"document_received_at"),
    pos_first_name:posFirst,pos_middle_name:posMiddle,pos_last_name:posLast,pos_name:posName,
    misp_name:mispName,
    applicant_phone:phone,applicant_email:email,
    pan_number:businessPan,gst_number:gst,address,city,state,postal_code:postalCode,
    bank_id:bank.id,bank_name:bank.name,bank_account_number:accountNumber,bank_ifsc_code:ifsc,
    oem_name:oemName,
    dp_first_name:dpFirst,dp_middle_name:dpMiddle,dp_last_name:dpLast,dp_name:dpName,
    dp_phone:isMisp?phone:null,dp_email:isMisp?email:null,dp_pan_number:dpPan,
    dp_date_of_birth:isMisp?dob:null,dp_aadhaar_last_four:isMisp?aadhaar.lastFour:null,dp_aadhaar_hash:isMisp?aadhaar.hash:null,dp_aadhaar_number_encrypted:isMisp?aadhaar.encrypted:null,
    date_of_birth:isMisp?null:dob,aadhaar_last_four:isMisp?null:aadhaar.lastFour,aadhaar_hash:isMisp?null:aadhaar.hash,aadhaar_number_encrypted:isMisp?null:aadhaar.encrypted,
    updated_by:manager.id
  };

  const nextStatus=errors.length?"invalid":"parsed";
  const{error:updateError}=await admin.from("posp_misp_import_rows").update({normalized_data:normalized,validation_errors:errors,status:nextStatus,error_message:null,application_id:null}).eq("id",rowId);
  if(updateError)redirect(`/customers/posp-misp/import/${batchId}?error=row_update_failed`);
  await refreshBatch(admin,batchId);
  redirect(`/customers/posp-misp/import/${batchId}?success=row_updated`);
}

async function currentManager(){const token=await getServerAccessToken();const{profile}=await getAuthenticatedProfile(token);if(!profile?.id||!canManagePospMispOnboarding(profile.role))throw new Error("Not authorized.");return profile}
async function refreshBatch(admin:ReturnType<typeof createSupabaseAdminClient>,batchId:string){const{data}=await admin.from("posp_misp_import_rows").select("status").eq("import_batch_id",batchId).returns<Array<{status:string}>>();const rows=data??[];const count=(s:string)=>rows.filter(row=>row.status===s).length;const parsed=count("parsed"),invalid=count("invalid"),submitted=count("submitted"),failed=count("failed"),processing=count("processing");const status=processing?"processing":rows.length&&submitted===rows.length?"submitted":submitted?"partially_submitted":failed&&!parsed?"failed":"parsed";await admin.from("posp_misp_import_batches").update({total_rows:rows.length,valid_rows:parsed,invalid_rows:invalid,pending_rows:parsed+processing,submitted_rows:submitted,failed_rows:failed,status}).eq("id",batchId)}
function value(data:FormData,key:string){const current=data.get(key);return typeof current==="string"&&current.trim()?current.trim():null}
function compactUpper(data:FormData,key:string){return value(data,key)?.replace(/\s/g,"").toUpperCase()??null}
function onlyDigits(data:FormData,key:string){const current=value(data,key)?.replace(/\D/g,"")??"";return current||null}
function normalizePhone(input:string|null){if(!input)return null;let digits=input.replace(/\D/g,"");if(digits.length>10&&digits.startsWith("91"))digits=digits.slice(-10);return /^[0-9]{10}$/.test(digits)?`+91${digits}`:null}
function personName(data:FormData,key:string){const current=value(data,key);return current?.replace(/\s+/g," ").trim()??null}
