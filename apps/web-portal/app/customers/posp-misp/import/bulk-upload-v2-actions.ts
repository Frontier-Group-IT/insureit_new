"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { normalizeImportedDate } from "@/lib/indian-date";
import { requirePospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { parsePospMispWorkbook, WorkbookValidationError } from "@/lib/posp-misp-workbook";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PospMispState } from "../actions";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PERSON_NAME = /^[A-Za-z ]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PartnerType = "posp" | "misp";
type Associate = { id:string; profile_id:string|null; full_name:string|null; employee_code:string|null };
type Bank = { id:string; name:string };

type NormalizedV2Row = {
  partner_type: PartnerType;
  associate_employee_id: string|null;
  associate_profile_id: string|null;
  associate_name: string|null;
  associate_id: string|null;
  external_onboarding_id: string|null;
  document_received_at: string|null;
  pos_first_name: string|null;
  pos_middle_name: string|null;
  pos_last_name: string|null;
  pos_name: string|null;
  misp_name: string|null;
  applicant_phone: string|null;
  applicant_email: string|null;
  pan_number: string|null;
  gst_number: string|null;
  address: string|null;
  city: string|null;
  state: string|null;
  postal_code: string|null;
  bank_id: string|null;
  bank_name: string|null;
  bank_account_number: string|null;
  bank_ifsc_code: string|null;
  oem_name: string|null;
  dp_first_name: string|null;
  dp_middle_name: string|null;
  dp_last_name: string|null;
  dp_name: string|null;
  dp_phone: string|null;
  dp_email: string|null;
  dp_pan_number: string|null;
  dp_date_of_birth: string|null;
  dp_aadhaar_last_four: string|null;
  dp_aadhaar_hash: string|null;
  dp_aadhaar_number_encrypted: string|null;
  date_of_birth: string|null;
  aadhaar_last_four: string|null;
  aadhaar_hash: string|null;
  aadhaar_number_encrypted: string|null;
  education_status: "not_received";
  iib_remarks: null;
  iib_upload_status: "pending";
  iib_uploaded: false;
  iib_uploaded_at: null;
  training_credentials_shared: null;
  training_credentials_shared_flag: false;
  training_login_id: null;
  training_password: null;
  training_start_date: null;
  training_end_date: null;
  training_status: null;
  training_certificate_number: null;
  exam_status: null;
  onboarding_date: null;
};

export async function uploadPospMispWorkbookV2(_state:PospMispState,data:FormData):Promise<PospMispState>{
  await requirePospMispManager();
  const file=data.get("workbook");
  if(!(file instanceof File)||!file.size)return fail("Choose the POSP / MISP v2 workbook.","workbook");
  let sheets;
  try{sheets=await parsePospMispWorkbook(file)}catch(error){
    if(error instanceof WorkbookValidationError)return fail(error.message,"workbook");
    const ref=randomUUID().slice(0,8);console.error(`POSP/MISP v2 workbook parse failed [${ref}]`,error);return fail(`The workbook could not be processed. Reference ${ref}.`,"workbook");
  }
  const admin=createSupabaseAdminClient();
  const [associates,banks,oems]=await Promise.all([loadPospMispAssociates(admin),loadBanks(admin),loadOems(admin)]);
  const rows:Array<{partner_type:PartnerType;sheet_name:string;row_number:number;source_data:Record<string,unknown>;normalized_data:NormalizedV2Row;validation_errors:string[]}>=[];
  for(const type of ["posp","misp"] as const){
    const sheet=sheets.find(item=>item.name===type.toUpperCase());
    if(!sheet)continue;
    sheet.rows.forEach((source,index)=>{
      const normalized=normalizeRow(type,source,associates,banks,oems);
      rows.push({partner_type:type,sheet_name:type.toUpperCase(),row_number:index+2,source_data:sanitizeSource(source),normalized_data:normalized,validation_errors:validateRow(normalized,source)});
    });
  }
  if(!rows.length)return fail("The workbook does not contain any POSP or MISP data rows.","workbook");
  addWorkbookDuplicateErrors(rows);
  const valid=rows.filter(row=>!row.validation_errors.length).length;
  const invalid=rows.length-valid;
  const {data:batch,error:batchError}=await admin.from("posp_misp_import_batches").insert({file_name:file.name,total_rows:rows.length,valid_rows:valid,invalid_rows:invalid,pending_rows:valid,submitted_rows:0,failed_rows:0,status:"parsed"}).select("id").single<{id:string}>();
  if(batchError||!batch)return fail("The import batch could not be created.","workbook");
  const {error:rowsError}=await admin.from("posp_misp_import_rows").insert(rows.map(row=>({import_batch_id:batch.id,partner_type:row.partner_type,sheet_name:row.sheet_name,row_number:row.row_number,source_data:row.source_data,normalized_data:row.normalized_data,validation_errors:row.validation_errors,status:row.validation_errors.length?"invalid":"parsed"})));
  if(rowsError){await admin.from("posp_misp_import_batches").delete().eq("id",batch.id);return fail("The parsed rows could not be saved.","workbook")}
  redirect(`/customers/posp-misp/import/${batch.id}`);
}

function normalizeRow(type:PartnerType,source:Record<string,unknown>,associates:Associate[],banks:Bank[],oems:Set<string>):NormalizedV2Row{
  const associate=resolveAssociate(associates,text(source,"Associate Employee Code"),text(source,"Associate Name"));
  const bank=resolveBank(banks,text(source,"Bank Name"));
  const posFirst=type==="posp"?cleanName(text(source,"POS First Name")):null;
  const posMiddle=type==="posp"?cleanName(text(source,"POS Middle Name")):null;
  const posLast=type==="posp"?cleanName(text(source,"POS Last Name")):null;
  const dpFirst=type==="misp"?cleanName(text(source,"DP First Name")):null;
  const dpMiddle=type==="misp"?cleanName(text(source,"DP Middle Name")):null;
  const dpLast=type==="misp"?cleanName(text(source,"DP Last Name")):null;
  const aadhaar=normalizeAadhaar(text(source,type==="posp"?"Aadhaar Number":"DP Aadhaar Number"));
  const dpPhone=type==="misp"?normalizePhone(text(source,"DP Mobile")):null;
  const dpEmail=type==="misp"?lower(text(source,"DP Email")):null;
  const applicantPhone=type==="misp"?dpPhone:normalizePhone(text(source,"Mobile Number"));
  const applicantEmail=type==="misp"?dpEmail:lower(text(source,"Email"));
  return {
    partner_type:type,
    associate_employee_id:associate?.id??null,associate_profile_id:associate?.profile_id??null,associate_name:associate?.full_name??text(source,"Associate Name"),associate_id:associate?.employee_code??text(source,"Associate Employee Code"),
    external_onboarding_id:upperCompact(text(source,type==="posp"?"POSP ID":"MISP ID")),document_received_at:dateValue(source["Document Received Date"]),
    pos_first_name:posFirst,pos_middle_name:posMiddle,pos_last_name:posLast,pos_name:joinName(posFirst,posMiddle,posLast),misp_name:type==="misp"?text(source,"MISP Name"):null,
    applicant_phone:applicantPhone,applicant_email:applicantEmail,pan_number:upperCompact(text(source,type==="posp"?"PAN Number":"MISP PAN")),gst_number:upperCompact(text(source,"GST Number")),
    address:text(source,type==="misp"?"Company Address":"Address"),city:text(source,"City"),state:text(source,"State"),postal_code:digits(text(source,"PIN Code")),
    bank_id:bank?.id??null,bank_name:bank?.name??text(source,"Bank Name"),bank_account_number:digits(text(source,"Account Number")),bank_ifsc_code:upperCompact(text(source,"IFSC Code")),
    oem_name:type==="misp"?resolveOem(oems,text(source,"OEM Name")):null,
    dp_first_name:dpFirst,dp_middle_name:dpMiddle,dp_last_name:dpLast,dp_name:joinName(dpFirst,dpMiddle,dpLast),dp_phone:dpPhone,dp_email:dpEmail,dp_pan_number:type==="misp"?upperCompact(text(source,"DP PAN")):null,
    dp_date_of_birth:type==="misp"?dateValue(source["DP Date of Birth"]):null,dp_aadhaar_last_four:type==="misp"?aadhaar.lastFour:null,dp_aadhaar_hash:type==="misp"?aadhaar.hash:null,dp_aadhaar_number_encrypted:type==="misp"?aadhaar.encrypted:null,
    date_of_birth:type==="posp"?dateValue(source["Date of Birth"]):null,aadhaar_last_four:type==="posp"?aadhaar.lastFour:null,aadhaar_hash:type==="posp"?aadhaar.hash:null,aadhaar_number_encrypted:type==="posp"?aadhaar.encrypted:null,
    education_status:"not_received",iib_remarks:null,iib_upload_status:"pending",iib_uploaded:false,iib_uploaded_at:null,training_credentials_shared:null,training_credentials_shared_flag:false,training_login_id:null,training_password:null,training_start_date:null,training_end_date:null,training_status:null,training_certificate_number:null,exam_status:null,onboarding_date:null
  };
}

function validateRow(row:NormalizedV2Row,source:Record<string,unknown>){
  const errors:string[]=[];
  if(!row.associate_employee_id)errors.push("Select a valid Sales department employee as Associate.");
  if(!row.external_onboarding_id)errors.push(`${row.partner_type==="misp"?"MISP":"POSP"} ID is required.`);
  if(row.partner_type==="posp"){
    if(!row.pos_first_name)errors.push("POS First Name is required.");
    if(!row.pos_last_name)errors.push("POS Last Name is required.");
    validateName(errors,row.pos_first_name,"POS First Name");validateName(errors,row.pos_middle_name,"POS Middle Name");validateName(errors,row.pos_last_name,"POS Last Name");
    if(!PAN.test(row.pan_number??""))errors.push("PAN Number is invalid.");
    if(!row.date_of_birth)errors.push("Date of Birth must use DD/MM/YYYY format.");
    if(!row.aadhaar_hash)errors.push("Aadhaar Number must contain exactly 12 digits.");
  }else{
    if(!row.misp_name)errors.push("MISP Name is required.");
    if(!PAN.test(row.pan_number??""))errors.push("MISP PAN is invalid.");
    if(!row.oem_name)errors.push("Select a valid OEM Name.");
    if(row.gst_number&&!GST.test(row.gst_number))errors.push("GST Number is invalid.");
    if(!row.dp_first_name)errors.push("DP First Name is required.");
    if(!row.dp_last_name)errors.push("DP Last Name is required.");
    validateName(errors,row.dp_first_name,"DP First Name");validateName(errors,row.dp_middle_name,"DP Middle Name");validateName(errors,row.dp_last_name,"DP Last Name");
    if(!PAN.test(row.dp_pan_number??""))errors.push("DP PAN is invalid.");
    if(!row.dp_date_of_birth)errors.push("DP Date of Birth must use DD/MM/YYYY format.");
    if(!row.dp_aadhaar_hash)errors.push("DP Aadhaar Number must contain exactly 12 digits.");
  }
  if(!row.applicant_phone)errors.push(`${row.partner_type==="misp"?"DP Mobile":"Mobile Number"} must contain exactly 10 digits.`);
  if(!row.applicant_email||!EMAIL.test(row.applicant_email))errors.push(`${row.partner_type==="misp"?"DP Email":"Email"} is invalid.`);
  if(!row.address)errors.push("Address is required.");if(!row.city)errors.push("City is required.");if(!row.state)errors.push("State is required.");
  if(!/^[0-9]{6}$/.test(row.postal_code??""))errors.push("PIN Code must contain exactly 6 digits.");
  if(!row.bank_id)errors.push("Select a bank from the approved bank master.");
  if(!/^[0-9]{6,20}$/.test(row.bank_account_number??""))errors.push("Account Number is invalid.");
  if(!IFSC.test(row.bank_ifsc_code??""))errors.push("IFSC Code is invalid.");
  if(source["Document Received Date"]&&!row.document_received_at)errors.push("Document Received Date must use DD/MM/YYYY format.");
  return [...new Set(errors)];
}

function addWorkbookDuplicateErrors(rows:Array<{normalized_data:NormalizedV2Row;validation_errors:string[]}>){
  const counts=new Map<string,number>();
  rows.forEach(row=>{const key=row.normalized_data.external_onboarding_id;if(key)counts.set(key,(counts.get(key)??0)+1)});
  rows.forEach(row=>{const key=row.normalized_data.external_onboarding_id;if(key&&(counts.get(key)??0)>1)row.validation_errors.push("External ID is duplicated in this workbook.")});
}
function validateName(errors:string[],value:string|null,label:string){if(value&&!PERSON_NAME.test(value))errors.push(`${label} may contain letters and spaces only.`)}
function normalizePhone(value:string|null){let number=digits(value);if(number.length>10&&number.startsWith("91"))number=number.slice(-10);return number.length===10?`+91${number}`:null}
function normalizeAadhaar(value:string|null){const number=digits(value);return /^[0-9]{12}$/.test(number)?{lastFour:number.slice(-4),hash:createHash("sha256").update(number).digest("hex"),encrypted:encryptSensitiveValue(number)}:{lastFour:null,hash:null,encrypted:null}}
function resolveAssociate(items:Associate[],code:string|null,name:string|null){const c=code?.trim().toLowerCase();const n=name?.trim().toLowerCase();return items.find(item=>item.employee_code?.trim().toLowerCase()===c)??items.find(item=>item.full_name?.trim().toLowerCase()===n)??null}
function resolveBank(items:Bank[],name:string|null){const normalized=normalizeLookup(name);return items.find(item=>normalizeLookup(item.name)===normalized)??null}
function resolveOem(items:Set<string>,name:string|null){if(!name)return null;return [...items].find(item=>item.toLowerCase()===name.trim().toLowerCase())??null}
async function loadBanks(admin:ReturnType<typeof createSupabaseAdminClient>){const{data}=await admin.from("banks").select("id,name").eq("is_active",true).order("name").returns<Bank[]>();return data??[]}
async function loadOems(admin:ReturnType<typeof createSupabaseAdminClient>){const{data}=await admin.from("vehicle_manufacturers").select("name").eq("is_active",true).returns<Array<{name:string}>>();return new Set((data??[]).map(item=>item.name))}
function text(source:Record<string,unknown>,key:string){const value=source[key];return value===null||value===undefined?null:String(value).trim()||null}
function dateValue(value:unknown){return normalizeImportedDate(value,{ambiguousExcelDatesAreDayFirst:true})}
function upperCompact(value:string|null){return value?.replace(/\s/g,"").toUpperCase()||null}
function lower(value:string|null){return value?.trim().toLowerCase()||null}
function digits(value:string|null){return value?.replace(/\D/g,"")??""}
function cleanName(value:string|null){return value?.replace(/\s+/g," ").trim()||null}
function joinName(...parts:Array<string|null>){return parts.filter(Boolean).join(" ")||null}
function normalizeLookup(value:string|null){return value?.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,"")??""}
function sanitizeSource(source:Record<string,unknown>){const copy={...source};for(const key of ["Aadhaar Number","DP Aadhaar Number","Account Number"])if(key in copy)copy[key]="Stored securely";return copy}
function fail(error:string,field:string|null=null):PospMispState{return{error,field}}
