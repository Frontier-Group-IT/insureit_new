import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { DataError } from "@/components/record-list";
import { canAccessImportBatch } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ImportRowReviewTableV2 } from "../import-row-review-table-v2";
import { submitPospMispImportBatchV2 } from "../bulk-submit-v2-actions";
import { decryptSensitiveValue } from "@/lib/sensitive-data";
import { PanVerificationAutoRefresh } from "../../../applications/pan-verification-auto-refresh";

type Batch={id:string;file_name:string;total_rows:number;valid_rows:number;invalid_rows:number;pending_rows:number;submitted_rows:number;failed_rows:number;status:string;created_at:string};
type ImportRow={id:string;row_number:number;sheet_name:string;partner_type:"posp"|"misp";source_data:Record<string,unknown>;normalized_data:Record<string,unknown>;validation_errors:string[]|null;status:string;application_id:string|null;error_message:string|null;documents?:Array<{document_type:string;file_name:string}>};
type RowDocument={import_row_id:string;document_type:string;file_name:string};
type PanJob={application_id:string;status:string;result_message:string|null;last_error:string|null;checked_by_device:string|null};
type RouteProfile={application_id:string;requested_account_type:"posp"|"misp"|null;final_account_type:"posp"|"misp"|"partner"|null;partner_decision:string;iib_remarks:string|null};

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function PospMispImportBatchPage({params,searchParams}:{params:Promise<{batchId:string}>;searchParams:Promise<{error?:string;success?:string;count?:string}>}){
  const profile=await requirePospMispManager();
  const {batchId}=await params;
  if(!profile?.id)redirect("/access-denied");
  const allowed=await canAccessImportBatch(profile.id,profile.role,batchId);
  if(!allowed)redirect("/access-denied");

  const query=await searchParams;
  const admin=createSupabaseAdminClient();
  const [{data:batch,error:batchError},{data:rows,error:rowsError},salesManagers,oems,banks]=await Promise.all([
    admin.from("posp_misp_import_batches").select("id,file_name,total_rows,valid_rows,invalid_rows,pending_rows,submitted_rows,failed_rows,status,created_at").eq("id",batchId).maybeSingle<Batch>(),
    admin.from("posp_misp_import_rows").select("id,row_number,sheet_name,partner_type,source_data,normalized_data,validation_errors,status,application_id,error_message").eq("import_batch_id",batchId).order("row_number",{ascending:true}).returns<ImportRow[]>(),
    loadSalesManagers(admin),loadVehicleManufacturers(admin),loadBanks(admin)
  ]);
  const rowIds=(rows??[]).map(row=>row.id);
  const applicationIds=(rows??[]).flatMap(row=>row.application_id?[row.application_id]:[]);
  const [{data:rowDocuments,error:documentsError},{data:panJobs},{data:routeProfiles}]=await Promise.all([
    rowIds.length?admin.from("posp_misp_import_row_documents").select("import_row_id,document_type,file_name").in("import_row_id",rowIds).returns<RowDocument[]>():Promise.resolve({data:[] as RowDocument[],error:null}),
    applicationIds.length?admin.from("pan_verification_jobs").select("application_id,status,result_message,last_error,checked_by_device").in("application_id",applicationIds).returns<PanJob[]>():Promise.resolve({data:[] as PanJob[],error:null}),
    applicationIds.length?admin.from("posp_misp_onboarding_profiles").select("application_id,requested_account_type,final_account_type,partner_decision,iib_remarks").in("application_id",applicationIds).returns<RouteProfile[]>():Promise.resolve({data:[] as RouteProfile[],error:null})
  ]);
  const documentsByRow=new Map<string,RowDocument[]>();
  for(const document of rowDocuments??[])documentsByRow.set(document.import_row_id,[...(documentsByRow.get(document.import_row_id)??[]),document]);
  const jobsByApplication=new Map((panJobs??[]).map(job=>[job.application_id,job]));
  const profilesByApplication=new Map((routeProfiles??[]).map(profileRow=>[profileRow.application_id,profileRow]));
  const rowsWithWorkflow=(rows??[]).map(row=>({...row,normalized_data:{...row.normalized_data,aadhaar_number:decryptSensitiveValue(typeof row.normalized_data.aadhaar_number_encrypted==="string"?row.normalized_data.aadhaar_number_encrypted:null)},documents:documentsByRow.get(row.id)??[],pan_job:row.application_id?jobsByApplication.get(row.application_id)??null:null,route_profile:row.application_id?profilesByApplication.get(row.application_id)??null:null}));
  const shouldRefresh=rowsWithWorkflow.some(row=>row.application_id&&(!row.pan_job||["pending","queued","checking"].includes(row.pan_job.status)));
  return <AppShell title="POSP / MISP Import Review"><PanVerificationAutoRefresh enabled={shouldRefresh}/><div className="mx-auto max-w-[1440px] space-y-3 pb-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex flex-wrap items-center gap-3"><Link href="/customers/posp-misp/import/batches" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">← Back to Import Batches</Link><Link href="/customers/posp-misp" className="text-[10.5px] font-semibold text-[#64748B] hover:underline">Onboarding Applications</Link></div><h1 className="mt-2 text-lg font-semibold text-[#0F172A]">{batch?.file_name??"Import batch"}</h1><p className="mt-1 text-[11px] text-[#64748B]">Review primary details, submit valid rows, and return here later to complete any remaining onboarding work.</p></div><div className="flex items-center gap-2"><Link href="/api/templates/posp-misp-v2" className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[11px] font-semibold text-indigo-700">Download v2 Template</Link>{batch&&batch.status!=="processing"&&batch.valid_rows>0?<form action={submitPospMispImportBatchV2}><input type="hidden" name="batch_id" value={batch.id}/><FormSubmitButton label="Submit Ready Rows" pendingLabel="Submitting" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-4 py-2.5 text-[11px] font-semibold text-white shadow-lg disabled:opacity-70"/></form>:null}{batch&&batch.status!=="processing"&&batch.failed_rows>0?<form action={submitPospMispImportBatchV2}><input type="hidden" name="batch_id" value={batch.id}/><input type="hidden" name="retry_failed" value="true"/><FormSubmitButton label="Retry Failed Rows" pendingLabel="Retrying" className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-800 disabled:opacity-70"/></form>:null}</div></div>
    {query.error?<DataError message={errorMessage(query.error)}/>:null}{query.success?<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">{successMessage(query.success,query.count)}</div>:null}
    {batchError||rowsError||documentsError||!batch?<DataError message={batch?"Import batch data could not be loaded.":"Import batch not found."}/>:<><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Total Rows" value={batch.total_rows}/><Metric label="Ready" value={batch.valid_rows} tone="success"/><Metric label="Invalid Rows" value={batch.invalid_rows} tone="warning"/><Metric label="Submitted" value={batch.submitted_rows} tone="success"/><Metric label="Failed" value={batch.failed_rows} tone="danger"/><Metric label="Status" value={batch.status.replaceAll("_"," ")}/></section><ImportRowReviewTableV2 batchId={batch.id} batchStatus={batch.status} rows={rowsWithWorkflow} salesManagers={salesManagers} oems={oems} banks={banks}/></>}
  </div></AppShell>;
}
function Metric({label,value,tone="default"}:{label:string;value:string|number;tone?:"default"|"success"|"warning"|"danger"}){const color=tone==="success"?"text-emerald-700":tone==="warning"?"text-amber-700":tone==="danger"?"text-red-700":"text-[#0F172A]";return <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur"><p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">{label}</p><p className={`mt-1 text-xl font-semibold capitalize ${color}`}>{value}</p></div>}
async function loadSalesManagers(admin:ReturnType<typeof createSupabaseAdminClient>){const managers=await loadPospMispAssociates(admin);return managers.map(manager=>({id:manager.id,fullName:manager.full_name?.trim()||"Unnamed Sales Employee",employeeCode:manager.employee_code}))}
async function loadVehicleManufacturers(admin:ReturnType<typeof createSupabaseAdminClient>){const{data}=await admin.from("vehicle_manufacturers").select("name").eq("is_active",true).order("sort_order",{ascending:true}).order("name",{ascending:true}).returns<Array<{name:string}>>();return(data??[]).map(item=>({value:item.name,label:item.name}))}
async function loadBanks(admin:ReturnType<typeof createSupabaseAdminClient>){const{data}=await admin.from("banks").select("id,name").eq("is_active",true).order("name").returns<Array<{id:string;name:string}>>();return(data??[]).map(item=>({value:item.id,label:item.name}))}
function errorMessage(error:string){const messages:Record<string,string>={no_valid_rows:"No valid rows are available for submission.",no_rows_selected:"Select at least one editable row before deleting.",row_missing:"The selected import row could not be found.",row_locked:"Submitted or processing rows cannot be deleted.",row_update_failed:"The row could not be updated.",row_delete_failed:"The selected rows could not be removed.",document_upload_failed:"The document could not be uploaded. Use a PDF, JPG or PNG file no larger than 5 MB.",marksheet_type_required:"Select the marksheet type before uploading the marksheet.",master_data:"Sales employee, bank, or OEM master data could not be validated."};return messages[error]??"The batch could not be updated."}
function successMessage(success:string,count?:string){const messages:Record<string,string>={submitted:"Ready rows were created and queued for automatic IIB checking.",retried:"Failed rows were retried. Review the Import column for the result.",row_updated:"Row was saved and revalidated using the v2 onboarding fields.",row_removed:"Parsed row was removed from this batch.",rows_removed:`${Number(count)||0} selected row${Number(count)===1?" was":"s were"} removed from this batch.`};return messages[success]??"Saved successfully."}
