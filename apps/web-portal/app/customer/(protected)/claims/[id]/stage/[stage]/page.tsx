import "./customer-claim-reference.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { CUSTOMER_EXTERNAL_STAGE_FIELDS } from "@/lib/customer-claim-stage-fields";
import { saveCustomerExternalStage } from "./actions";
import { CustomerClaimStageSubmit } from "@/components/customer-portal/customer-claim-stage-submit";
import { CustomerClaimEvidenceWorkspace } from "@/components/customer-portal/customer-claim-evidence-workspace";
import { CustomerClaimVoiceRecorder } from "@/components/customer-portal/customer-claim-voice-recorder";
import { CustomerClaimDocumentGroups } from "@/components/customer-portal/customer-claim-document-groups";
import { CustomerClaimBooleanChoice } from "@/components/customer-portal/customer-claim-boolean-choice";
import { Check, Circle, LockKeyhole, CalendarDays, Clock3, ClipboardList } from "lucide-react";
import { CustomerClaimStageStrip } from "@/components/customer-portal/customer-claim-stage-strip";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim, buildExternalClaimProjection } from "@/lib/customer-web-phase2-data";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function CustomerClaimStage({params,searchParams}:{params:Promise<{id:string;stage:string}>;searchParams?:Promise<{account?:string;mode?:string;saved?:string}>}) {
  const p=await params;const q=searchParams?await searchParams:{};
  const {account}=await resolveCustomerWebScope(q.account);
  const {claim,milestones,documents,internal_projection}=await loadCustomerClaimDetail(account.id,p.id);
  const selected=INTERNAL_JOURNEY_STAGES.find(s=>s.key===p.stage);
  if(!selected) notFound();
  const external=isExternalCustomerClaim(claim);
  const projection=external?buildExternalClaimProjection(milestones):null;
  const currentIndex=external ? INTERNAL_JOURNEY_STAGES.findIndex(s=>s.key===projection?.current_stage.key) : internal_projection?.stageIndex ?? 0;
  const activeIndex=INTERNAL_JOURNEY_STAGES.findIndex(s=>s.key===selected.key);
  const completed=external ? projection?.stages.find(s=>s.key===p.stage)?.completed || false : activeIndex<(internal_projection?.completedStageCount??0);
  const milestone=milestones.find(m=>m.milestone_key===selected.key);
  if (selected.key==="spot_intimation" && claim.current_status==="Draft") {
    redirect("/customer/spot-intimation?account="+encodeURIComponent(account.id)+"&id="+encodeURIComponent(claim.id));
  }
  const canEditStage = external && Boolean(CUSTOMER_EXTERNAL_STAGE_FIELDS[selected.key]) && !completed && activeIndex===currentIndex;
  if (q.mode !== "edit") redirect("/customer/claims/"+encodeURIComponent(claim.id)+"/stage/"+encodeURIComponent(selected.key)+"?account="+encodeURIComponent(account.id)+"&mode=edit");
  const editMode = true;
  const canUploadStage = selected.key==="spot_intimation" || selected.key==="claim_intimation";
  const allowEdit = canEditStage || canUploadStage;
  return <div className="customer-claim-ref-page space-y-3">
    {q.saved==="claim_intimation" && selected.key==="work_approval" ? <div role="status" className="rounded-xl border border-[#B8E2CA] bg-[#F0FBF5] px-4 py-3 text-[12px] font-bold text-[#08744A]">Stage details saved successfully</div> : null}
    <CustomerClaimStageStrip claimId={claim.id} accountId={account.id} selectedKey={selected.key} currentKey={INTERNAL_JOURNEY_STAGES[currentIndex]?.key || "spot_intimation"} editMode completedKeys={INTERNAL_JOURNEY_STAGES.filter((stage,i)=>external?projection?.stages.some(x=>x.key===stage.key&&x.completed):i<(internal_projection?.completedStageCount??0)).map(stage=>stage.key)} />
    {!(editMode && canEditStage) ? <section className="overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white">
      <h2 className="border-b border-[#D9E3F0] px-5 py-4 text-[17px] font-semibold text-[#071D49]">{selected.key==="spot_intimation"?"Accident & Spot Intimation Details":selected.label+" Details"}</h2>
      {selected.key==="spot_intimation" ? (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          {([
            ["Accident Date & Time",claim.accident_at],
            ["Spot Intimation Date & Time",claim.spot_intimation_at||(typeof milestone?.details?.spot_intimation_at==="string"?milestone.details.spot_intimation_at:null)],
            ["Driver Name",milestone?.details?.driver_name||(claim.accident_description?.match(/Driver:\\s*([^\\n]+)/)?.[1]??null)],
            ["Driver Number",milestone?.details?.driver_phone||(claim.accident_description?.match(/Driver phone:\\s*([^\\n]+)/)?.[1]??null)],
            ["Location",claim.accident_location||milestone?.details?.location],
          ] as Array<[string,unknown]>).map(([label,value])=>{
            const isDateTime=label==="Accident Date & Time"||label==="Spot Intimation Date & Time";
            const parsed=isDateTime&&typeof value==="string"&&value?new Date(value):null;
            const valid=parsed&&!Number.isNaN(parsed.getTime());
            const date=valid?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",day:"2-digit",month:"2-digit",year:"numeric"}).format(parsed).replaceAll("/","-"):"";
            const time=valid?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(parsed):"";
            return <div key={label} className={isDateTime?"min-w-0 md:col-span-1 xl:col-span-1":"min-w-0"}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label}{isDateTime?<span className="ml-1 text-red-500">*</span>:null}</p>
              {isDateTime?<div className="grid min-h-10 grid-cols-2 overflow-hidden rounded-xl border border-[#CAD8EE] bg-white text-[12px] font-medium text-[#18345C]" aria-label={label+" saved date and time"}>
                <div className="flex min-w-0 items-center justify-between gap-1 border-r border-[#D9E3F0] px-2.5"><span className="truncate">{date||"DD-MM-YYYY"}</span><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#182B45]"/></div>
                <div className="flex min-w-0 items-center justify-between gap-1 px-2.5"><span className="truncate">{time||"HH:MM"}</span><Clock3 className="h-3.5 w-3.5 shrink-0 text-[#182B45]"/></div>
              </div>:<div className="flex min-h-10 items-center overflow-hidden rounded-md border border-[#D9E3F0] bg-white px-3 text-[12px] font-medium text-[#071D49]">
                <span className="truncate" title={typeof value==="string"?value:""}>{typeof value==="string"&&value?value:"—"}</span>
              </div>}
            </div>;
          })}

        </div>
      ):(
        <div className="p-4">
          {milestone?.details && Object.entries(milestone.details).length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(milestone.details).filter(([,value])=>["string","number","boolean"].includes(typeof value)).map(([key,value])=><div key={key}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{key.replace(/_/g," ")}</p>
              <div className="min-h-9 rounded-md border border-[#D9E3F0] bg-white px-3 py-2 text-[12px] font-medium text-[#071D49]">{String(value)}</div>
            </div>)}
          </div>:<p className="text-[12px] text-[#64748B]">No details recorded for this stage yet.</p>}
          <p className="mt-3 flex items-center gap-2 text-[11px] text-[#536781]">{completed?<Check className="h-4 w-4 text-[#0A9B72]"/>:activeIndex===currentIndex?<Circle className="h-4 w-4 text-[#155EEF]"/>:<LockKeyhole className="h-4 w-4"/>}{completed?"Completed":activeIndex===currentIndex?"Current stage":"Upcoming stage"}</p>
        </div>
      )}
    </section> : null}
    {editMode && canEditStage ? (
      <form id="customer-claim-stage-details-form" action={saveCustomerExternalStage} className="customer-claim-ref-details mt-2 rounded-2xl border border-[#D9E6F7] bg-[#F7F6FF] p-4">
        <div className="mb-3 flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#6F5AF1] to-[#3697D5] text-white"><ClipboardList className="h-4 w-4"/></span><div><h2 className="text-[15px] font-bold text-[#071D49]">Stage Details</h2><p className="text-[12px] text-[#75869A]">Record {selected.label.toLowerCase()} details.</p></div></div></div><div className={`grid gap-3 sm:grid-cols-2 ${selected.key==="claim_intimation"?"lg:grid-cols-5":selected.key==="work_approval"||selected.key==="payment_encashment"?"lg:grid-cols-5":selected.key==="repair_ri"||selected.key==="delivery_order"?"lg:grid-cols-3":selected.key==="billing"||selected.key==="vehicle_delivery"?"lg:grid-cols-2":"lg:grid-cols-4"}`}>
        <input type="hidden" name="account" value={account.id}/>
        <input type="hidden" name="claim" value={claim.id}/>
        <input type="hidden" name="stage" value={selected.key}/>
        {CUSTOMER_EXTERNAL_STAGE_FIELDS[selected.key].map(field=>(
          <label key={field.key} className="customer-claim-ref-field min-w-0 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#5673B0]">{field.label}{field.optional?"":" *"}
            {field.type==="boolean"||field.type==="yesno"?(
<CustomerClaimBooleanChoice name={field.key} kind={field.type} value={typeof milestone?.details?.[field.key]==="boolean"?String(milestone.details[field.key]):typeof milestone?.details?.[field.key]==="string"?String(milestone.details[field.key]):""}/>
            ):(
              <input name={field.key} type={field.type} required={!field.optional} maxLength={field.type==="number"?undefined:500} min={field.type==="number"?"0":undefined} step={field.type==="number"?"0.01":undefined} defaultValue={typeof milestone?.details?.[field.key]==="string"||typeof milestone?.details?.[field.key]==="number"?String(milestone.details[field.key]):""} className="mt-1 h-9 w-full rounded-md border border-[#D9E3F0] bg-white px-3 text-[12px] font-semibold normal-case tracking-normal text-[#071D49]"/>
            )}
          </label>
        ))}</div>
        {selected.key!=="claim_intimation"?<div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[#D9E3F0] pt-4">
          <Link href={{pathname:"/customer/claims",query:{account:account.id}}} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#B9CBE2] px-5 text-[12px] font-semibold text-[#174A87]">Cancel</Link>
          <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1253A7] px-5 text-[12px] font-bold text-white hover:bg-[#0B3884]">Save &amp; Continue</button>
        </div>:null}
      </form>
    ):null}
    {selected.key==="spot_intimation" ? <CustomerClaimEvidenceWorkspace documents={documents} claimId={claim.id} accountId={account.id} stage={selected.key} allowUpload={editMode}/> : null}
    {selected.key==="spot_intimation" ? <CustomerClaimVoiceRecorder claimId={claim.id} accountId={account.id}/> : null}
    {selected.key==="claim_intimation" ? <CustomerClaimDocumentGroups documents={documents} claimId={claim.id} accountId={account.id} stage={selected.key} showSaveDetails={false} allowUpload={editMode && external && !completed && activeIndex===currentIndex} /> : null}
    {selected.key==="claim_intimation" && editMode && canEditStage ? (
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[#D9E6F7] bg-white px-5 py-4">
        <Link href={{pathname:"/customer/claims",query:{account:account.id}}} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#B9CBE2] px-5 text-[12px] font-semibold text-[#174A87]">Cancel</Link>
        <CustomerClaimStageSubmit formId="customer-claim-stage-details-form" />
      </div>
    ) : null}
  </div>;
}
