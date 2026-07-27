import { FormSubmitButton } from "@/components/form-submit-button";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { prepareIntermediaryIibPayload, startIntermediaryIibHandoff } from "./iib-submission-actions";

type Props = { applicationId:string; agreementSigned:boolean; finalType:string|null };
type Packet = { status:string; missing_fields:string[]; payload:Record<string,any>; prepared_at:string|null; handoff_started_at:string|null };

export async function IibSubmissionStage({applicationId,agreementSigned,finalType}:Props){
 if(finalType==="partner"||!agreementSigned)return null;
 const admin=createSupabaseAdminClient();
 const{data:packet}=await admin.from("intermediary_iib_submission_packets").select("status,missing_fields,payload,prepared_at,handoff_started_at").eq("application_id",applicationId).maybeSingle<Packet>();
 const identity=packet?.payload?.identity??{};const address=packet?.payload?.address??{};const qualification=packet?.payload?.qualification??{};const documents=Array.isArray(packet?.payload?.documents)?packet.payload.documents:[];const ready=packet?.status==="ready"||packet?.status==="handoff_started";const portalUrl=process.env.NEXT_PUBLIC_IIB_POS_PORTAL_URL;
 return <section id="iib-submission" className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#BFD0E2] bg-white shadow-sm">
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5EF] bg-[#F8FAFC] px-5 py-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#64748B]">Stage 4</p><h2 className="mt-1 text-[14px] font-semibold text-[#0F172A]">IIB submission</h2><p className="mt-1 text-[9px] text-[#64748B]">Review the data before opening the IIB portal.</p></div><span className={`rounded-full px-3 py-1.5 text-[8.5px] font-semibold ${ready?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{ready?"Data ready":packet?"Details incomplete":"Not prepared"}</span></header>
  <div className="p-5">
   {!packet?<div className="flex flex-wrap items-center justify-between gap-4"><p className="text-[10px] text-[#475569]">Prepare the verified registration data for IIB entry.</p><form action={prepareIntermediaryIibPayload}><input type="hidden" name="application_id" value={applicationId}/><FormSubmitButton label="Prepare IIB data" pendingLabel="Preparing" className="rounded-xl bg-[#071D49] px-5 py-2.5 text-[10px] font-semibold text-white"/></form></div>:<div className="space-y-5">
    {packet.missing_fields.length?<div className="border-l-2 border-amber-400 pl-3"><p className="text-[10px] font-semibold text-amber-900">Complete these details</p><p className="mt-1 text-[9.5px] text-amber-800">{packet.missing_fields.join(" · ")}</p></div>:null}
    <DataGroup title="Identity" rows={[["Name",identity.name],["PAN",identity.pan],["Date of birth",identity.date_of_birth],["Mobile",identity.mobile],["Email",identity.email],["Aadhaar",maskAadhaar(identity.aadhaar)]]}/>
    <DataGroup title="Address" rows={[["Address",address.line],["City",address.city],["State",address.state],["Postal code",address.postal_code]]}/>
    <DataGroup title="Qualification" rows={[["Training",qualification.training_status],["Examination",qualification.exam_status],["Score",qualification.exam_score],["Agreement",qualification.agreement_status],["Documents",String(documents.length)]]}/>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4"><div className="text-[8.5px] text-[#64748B]">Prepared {formatDateTime(packet.prepared_at)}{packet.handoff_started_at?` · Portal handoff ${formatDateTime(packet.handoff_started_at)}`:""}</div><div className="flex flex-wrap gap-2"><form action={prepareIntermediaryIibPayload}><input type="hidden" name="application_id" value={applicationId}/><FormSubmitButton label="Refresh data" pendingLabel="Refreshing" className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#334155]"/></form>{ready?<form action={startIntermediaryIibHandoff}><input type="hidden" name="application_id" value={applicationId}/><FormSubmitButton label="Prepare portal handoff" pendingLabel="Preparing" className="rounded-xl bg-[#071D49] px-4 py-2.5 text-[10px] font-semibold text-white"/></form>:null}{ready&&portalUrl?<a href={portalUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-gradient-to-r from-[#6759FF] to-[#4F8DF6] px-4 py-2.5 text-[10px] font-semibold text-white">Open IIB portal</a>:null}</div></div>
    {!portalUrl&&ready?<p className="text-[8.5px] text-[#64748B]">Set NEXT_PUBLIC_IIB_POS_PORTAL_URL to enable the portal button.</p>:null}
   </div>}
  </div>
 </section>;
}
function DataGroup({title,rows}:{title:string;rows:Array<[string,unknown]>}){return <div><h3 className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#64748B]">{title}</h3><dl className="mt-2 divide-y divide-[#E8EDF3] border-y border-[#E8EDF3]">{rows.map(([label,value])=><div key={label} className="grid grid-cols-[140px_1fr] gap-4 py-2.5 text-[9.5px]"><dt className="text-[#64748B]">{label}</dt><dd className="break-words font-medium capitalize text-[#0F172A]">{display(value)}</dd></div>)}</dl></div>}
function display(value:unknown){if(value===null||value===undefined||value==="")return"-";return String(value).replaceAll("_"," ")}
function maskAadhaar(value:unknown){const text=String(value??"").replace(/\D/g,"");return text.length===12?`XXXX XXXX ${text.slice(-4)}`:"-"}
function formatDateTime(value:string|null|undefined){if(!value)return"-";const date=new Date(value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(date)}
