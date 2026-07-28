import Link from "next/link";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { completePospMispDocumentStage,decidePospMispPartnerRoute,movePospMispToIib,retryPospMispPanVerification } from "./posp-misp-workflow-actions";

export type PospMispWorkflowProfile={workflow_stage:"pre_iib"|"iib_processing"|"training"|"completed";partner_type:"posp"|"misp";pan_number:string|null;dp_pan_number:string|null;iib_remarks:string|null;iib_uploaded:boolean;iib_uploaded_at:string|null;training_login_id:string|null;training_credentials_shared_flag:boolean;training_start_date:string|null;training_end_date:string|null;training_status:string|null;training_certificate_number:string|null;exam_status:string|null;onboarding_date:string|null;external_onboarding_id?:string|null;existing_registration_confirmed?:boolean;existing_registration_code?:string|null};
type PanJob={status:"pending"|"queued"|"checking"|"matched"|"not_found"|"invalid"|"failed"|"manual_review";result_message:string|null;attempt_count:number;last_error:string|null;checked_by_device:string|null};
type RouteState={requested_account_type:"posp"|"misp"|null;final_account_type:"posp"|"misp"|"partner"|null;partner_decision:"not_applicable"|"pending"|"convert_to_partner"|"do_not_proceed";existing_registration_confirmed:boolean;existing_registration_code:string|null};
type Assignment={training_status:string;exam_status:string;agreement_status:string};
type ApplicationState={registration_status:string};

export async function PospMispWorkflowPanel({applicationId,profile}:{applicationId:string;profile:PospMispWorkflowProfile}){
 const admin=createSupabaseAdminClient();
 const [{data:job},{data:route},{count:documentCount},{data:assignment},{data:application}]=await Promise.all([
  admin.from("pan_verification_jobs").select("status,result_message,attempt_count,last_error,checked_by_device").eq("application_id",applicationId).maybeSingle<PanJob>(),
  admin.from("posp_misp_onboarding_profiles").select("requested_account_type,final_account_type,partner_decision,existing_registration_confirmed,existing_registration_code").eq("application_id",applicationId).maybeSingle<RouteState>(),
  admin.from("intermediary_onboarding_documents").select("id",{count:"exact",head:true}).eq("application_id",applicationId),
  admin.from("intermediary_training_exam_assignments").select("training_status,exam_status,agreement_status").eq("application_id",applicationId).maybeSingle<Assignment>(),
  admin.from("intermediary_onboarding_applications").select("registration_status").eq("id",applicationId).maybeSingle<ApplicationState>()
 ]);
 const stage=profile.workflow_stage;
 const partnerDecision=route?.partner_decision??"not_applicable";
 const partnerRoute=job?.status==="matched"&&partnerDecision==="convert_to_partner";
 const existingPosp=Boolean(route?.existing_registration_confirmed);
 const finalType=route?.final_account_type??route?.requested_account_type??profile.partner_type;
 const iibPan=profile.partner_type==="misp"?profile.dp_pan_number:profile.pan_number;
 const registrationStatus=application?.registration_status??"primary_pending";
 const qualificationTarget=qualificationActionTarget(assignment);
 return <div className="-my-2 space-y-2">
  <section className="rounded-2xl border border-[#CFE8DA] bg-gradient-to-r from-[#F4FBF7] via-white to-[#F8FAFC] px-4 py-3 shadow-sm">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0"><p className="text-[8.5px] font-semibold uppercase tracking-[.12em] text-[#64748B]">Automatic IIB status</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-[15px] font-semibold tracking-[.02em] text-[#0F172A]">{maskPan(job?.status?iibPan:null)}</p><StatusBadge status={job?.status??"pending"}/>{existingPosp?<span className="rounded-full bg-blue-50 px-2.5 py-1 text-[8.5px] font-semibold text-blue-700">Existing POSP confirmed</span>:null}</div><p className="mt-1 text-[10px] text-[#475569]">{existingPosp?`Registered under Sankalp Insurance${route?.existing_registration_code?` · ${route.existing_registration_code}`:""}`:jobMessage(job)}</p></div>
    <div className="flex shrink-0 flex-wrap items-center gap-2">
     {stage==="pre_iib"&&job?.status==="not_found"?<form action={movePospMispToIib}><input type="hidden" name="application_id" value={applicationId}/><FormSubmitButton label="Continue to Documents" pendingLabel="Opening documents" className="rounded-lg bg-gradient-to-r from-[#6759FF] to-[#4F8DF6] px-4 py-2 text-[10px] font-semibold text-white"/></form>:null}
     {stage==="pre_iib"&&job?.status==="matched"&&partnerDecision==="pending"?<>
      {profile.partner_type==="posp"?<form action={decidePospMispPartnerRoute} className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2"><input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="partner_decision" value="import_existing_posp"/><input type="hidden" name="existing_registration_confirmed" value="yes"/><input name="existing_registration_code" defaultValue={profile.external_onboarding_id??""} required placeholder="Existing POSP code" className="h-8 min-w-[150px] rounded-lg border border-blue-200 bg-white px-2 text-[9px] text-[#0F172A] outline-none"/><FormSubmitButton label="Import as Existing POSP" pendingLabel="Importing" className="rounded-lg bg-blue-700 px-3 py-2 text-[9px] font-semibold text-white"/></form>:null}
      <form action={decidePospMispPartnerRoute}><input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="partner_decision" value="convert_to_partner"/><FormSubmitButton label="Create as Partner" pendingLabel="Saving" className="rounded-lg bg-violet-600 px-4 py-2 text-[10px] font-semibold text-white"/></form>
      <form action={decidePospMispPartnerRoute}><input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="partner_decision" value="do_not_proceed"/><FormSubmitButton label="Do Not Proceed" pendingLabel="Closing" className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-[10px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"/></form>
     </>:null}
     {stage==="pre_iib"&&partnerRoute?<form action={movePospMispToIib}><input type="hidden" name="application_id" value={applicationId}/><FormSubmitButton label="Continue to Documents" pendingLabel="Opening documents" className="rounded-lg bg-gradient-to-r from-[#6759FF] to-[#4F8DF6] px-4 py-2 text-[10px] font-semibold text-white"/></form>:null}
     {stage==="pre_iib"&&(job?.status==="failed"||job?.status==="invalid")?<form action={retryPospMispPanVerification}><input type="hidden" name="application_id" value={applicationId}/><FormSubmitButton label="Retry PAN check" pendingLabel="Re-queuing" className="rounded-lg bg-[#071D49] px-4 py-2 text-[10px] font-semibold text-white"/></form>:null}
     {stage==="iib_processing"?<form action={completePospMispDocumentStage}><input type="hidden" name="application_id" value={applicationId}/><FormSubmitButton label={documentCount?(existingPosp?"Complete Existing POSP Documents":"Documents Complete"):"Upload Documents"} pendingLabel="Completing" disabled={!documentCount} className="rounded-lg bg-gradient-to-r from-[#6759FF] to-[#4F8DF6] px-4 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"/></form>:null}
     {stage==="training"?<Link href={`/intermediaries/applications/${applicationId}?stage=review#${qualificationTarget.anchor}`} className="rounded-lg bg-gradient-to-r from-[#6759FF] to-[#4F8DF6] px-4 py-2 text-center text-[10px] font-semibold text-white">{qualificationTarget.label}</Link>:null}
    </div>
   </div>
  </section>
  {partnerRoute?<section className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-[10.5px] font-semibold text-violet-800">Business Associate route selected</section>:null}
  {existingPosp?<section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[10.5px] font-semibold text-blue-800">Existing POSP route selected</section>:null}
  {stage==="completed"?<section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[10.5px] font-semibold text-emerald-700">{existingPosp?"Existing POSP documents completed. Account review is pending.":"Onboarding completed."}</section>:null}
  <span className="sr-only">{stageTitle(stage,registrationStatus)} · {finalType}</span>
 </div>;
}
function StatusBadge({status}:{status:PanJob["status"]}){const map:Record<string,[string,string,string]>={pending:["Waiting","bg-slate-100 text-slate-700",""],queued:["Queued","bg-blue-50 text-blue-700",""],checking:["Checking","bg-blue-50 text-blue-700",""],matched:["Existing IIB record","bg-amber-50 text-amber-700",""],not_found:["IIB Cleared","bg-emerald-100 text-emerald-700","✓"],invalid:["Invalid PAN","bg-red-50 text-red-700",""],failed:["Check failed","bg-red-50 text-red-700",""],manual_review:["Manual review","bg-violet-50 text-violet-700",""]};const[label,style,icon]=map[status]??map.pending;return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[8.5px] font-semibold ${style}`}>{icon?<span aria-hidden="true">{icon}</span>:null}{label}</span>}
function jobMessage(job:PanJob|null|undefined){if(!job)return"Waiting for the extension to collect this PAN.";return job.result_message??job.last_error??({pending:"Waiting for the extension.",queued:"Queued for checking.",checking:"The extension is checking this PAN in IIB POS.",matched:"Matching Record Found In DataBase",not_found:"No Data Found In POS System",invalid:"The PAN could not be checked.",failed:"The last check failed.",manual_review:"Manual review is required."}[job.status])}
function stageTitle(stage:PospMispWorkflowProfile["workflow_stage"],registrationStatus:string){if(stage==="pre_iib")return"Primary information & IIB check";if(stage==="iib_processing")return"Document upload";if(stage==="training")return registrationStatus.replaceAll("_"," ");return"Onboarding completed"}
function maskPan(value:string|null){return value&&value.length===10?`${value.slice(0,2)}****${value.slice(-3)}`:"PAN pending"}
function qualificationActionTarget(assignment:Assignment|null){if(!assignment?.training_status||assignment.training_status==="not_assigned")return{label:"Open training requirement",anchor:"training-requirement"};if(assignment.training_status!=="completed")return{label:"Continue training requirement",anchor:"training-requirement"};if(!assignment.exam_status||assignment.exam_status==="not_allotted")return{label:"Open examination requirement",anchor:"examination-requirement"};if(assignment.exam_status!=="passed")return{label:"Review examination status",anchor:"examination-requirement"};if(!assignment.agreement_status||assignment.agreement_status==="not_generated")return{label:"Open agreement requirement",anchor:"agreement-requirement"};return{label:"Review agreement status",anchor:"agreement-requirement"}}