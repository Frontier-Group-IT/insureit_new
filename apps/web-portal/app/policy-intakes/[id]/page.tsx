import type { ReactElement } from "react";
import { FileText, Phone, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/shell";
import { PolicyIntakeDocumentButton } from "@/components/policy-intake-document-button";
import { PolicyIntakeHandoffButton } from "@/components/policy-intake-handoff-button";
import { PolicyIntakeReviewActions } from "@/components/policy-intake-review-actions";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";

export const dynamic="force-dynamic";

type Intake={id:string;intake_number:string;status:string;lead_source_name:string;lead_source_type:string;lead_source_code:string|null;customer_mobile:string;matched_customer_id:string|null;file_name:string;ocr_status:string;ocr_fields:PolicyIntakeOcrField[];ocr_warnings:string[];attention_reason:string|null;created_at:string;submitted_by_profile_id:string;final_policy_id:string|null};

export default async function PolicyIntakeDetail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const profile=await requirePolicyIntakeViewer(); const reviewer=await hasEffectiveCapability(profile,"review_policy_intakes","edit"); const admin=createSupabaseAdminClient();
  const {data}=await admin.from("policy_intake_requests").select("id,intake_number,status,lead_source_name,lead_source_type,lead_source_code,customer_mobile,matched_customer_id,file_name,ocr_status,ocr_fields,ocr_warnings,attention_reason,created_at,submitted_by_profile_id,final_policy_id").eq("id",id).maybeSingle<Intake>();
  if(!data)return <AppShell title="Policy Intake"><div className="rounded-2xl bg-white p-5 text-[11px]">Intake not found.</div></AppShell>;
  if(!reviewer&&data.submitted_by_profile_id!==profile.id)return <AppShell title="Policy Intake"><div className="rounded-2xl bg-white p-5 text-[11px]">You do not have access to this intake.</div></AppShell>;
  return <AppShell title={data.intake_number}><div className="mx-auto grid max-w-[1180px] gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#DDE5EF] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#7A8798]">Policy intake</p><h1 className="mt-1 text-[15px] font-bold text-[#17365D]">{data.intake_number}</h1><p className="mt-1 text-[9px] text-[#667085]">Submitted {new Date(data.created_at).toLocaleString("en-IN")}</p></div><span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[8px] font-bold capitalize text-[#4F46E5]">{data.status.replaceAll("_"," ")}</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><Meta icon={<ShieldCheck/>} label="Lead source" value={`${data.lead_source_name}${data.lead_source_code?` · ${data.lead_source_code}`:""}`}/><Meta icon={<Phone/>} label="Customer" value={data.customer_mobile}/><Meta icon={<FileText/>} label="Document" value={data.file_name}/></div>
        {data.attention_reason?<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] text-amber-900">{data.attention_reason}</div>:null}
      </section>
      <section className="rounded-2xl border border-[#DDE5EF] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#7A8798]">OCR proposal</p><h2 className="mt-1 text-[12px] font-bold text-[#17365D]">Extracted policy details</h2></div><span className="text-[8px] font-semibold text-[#64748B]">{data.ocr_fields?.length??0} fields</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(data.ocr_fields??[]).map(field=><div key={field.key} className="rounded-xl border border-[#E5EAF1] bg-[#FAFBFD] px-3 py-2.5"><p className="text-[7.5px] font-bold uppercase tracking-[.06em] text-[#8A96A8]">{field.label}</p><p className="mt-1 break-words text-[10px] font-semibold text-[#253B59]">{field.value||"—"}</p>{typeof field.confidence==="number"?<p className="mt-1 text-[7px] text-[#98A2B3]">{Math.round(field.confidence*100)}% confidence</p>:null}</div>)}</div>{!(data.ocr_fields??[]).length?<p className="mt-3 text-[9px] text-[#7A8798]">OCR did not produce structured fields. Operations can request a clearer document.</p>:null}</section>
    </div>
    <aside className="space-y-3"><PolicyIntakeDocumentButton id={data.id}/>{reviewer&&!["completed","rejected"].includes(data.status)?<><PolicyIntakeHandoffButton id={data.id}/><PolicyIntakeReviewActions id={data.id}/></>:null}<div className="rounded-2xl border border-[#E2E8F0] bg-white p-3 text-[9px] leading-4 text-[#667085]"><UserRound className="mb-2 h-4 w-4 text-[#315B9A]"/>The intake is not an operational policy. A policy is created only after Operations verifies and books it through Policy Onboarding.</div></aside>
  </div></AppShell>;
}

function Meta({icon,label,value}:{icon:ReactElement;label:string;value:string}){return <div className="flex items-center gap-2 rounded-xl bg-[#F7F9FC] px-3 py-2.5"><span className="text-[#315B9A] [&_svg]:h-4 [&_svg]:w-4">{icon}</span><span className="min-w-0"><span className="block text-[7px] font-bold uppercase tracking-[.07em] text-[#8A96A8]">{label}</span><span className="block truncate text-[9px] font-semibold text-[#344054]">{value}</span></span></div>}
