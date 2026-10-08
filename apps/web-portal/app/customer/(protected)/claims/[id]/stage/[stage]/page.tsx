import Link from "next/link";
import { notFound } from "next/navigation";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { CUSTOMER_EXTERNAL_STAGE_FIELDS } from "@/lib/customer-claim-stage-fields";
import { saveCustomerExternalStage } from "./actions";
import { CustomerClaimEvidenceWorkspace } from "@/components/customer-portal/customer-claim-evidence-workspace";
import { Check, Circle, ArrowLeft, LockKeyhole } from "lucide-react";
import { CustomerClaimStageStrip } from "@/components/customer-portal/customer-claim-stage-strip";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim, buildExternalClaimProjection } from "@/lib/customer-web-phase2-data";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function CustomerClaimStage({params,searchParams}:{params:Promise<{id:string;stage:string}>;searchParams?:Promise<{account?:string}>}) {
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
  return <div className="space-y-3">
    <Link href={{pathname:`/customer/claims/${claim.id}`,query:{account:account.id}}} className="inline-flex items-center gap-2 text-sm font-bold text-[#245DAB]"><ArrowLeft className="h-4 w-4"/> Claim overview</Link>
    <div className="rounded-xl bg-[#0B3884] p-3 text-white"><p className="text-xs font-bold uppercase tracking-wider text-white/75">{external?"Self-tracked claim":"INSUREIT-managed claim"}</p><div className="mt-2 flex items-center gap-3"><img src={"/assets/customer-claim/stages/"+selected.key+".png"} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1"/><h1 className="text-2xl font-black">{selected.label}</h1></div><p className="mt-1 text-sm text-white/80">{claim.claim_no} · {claim.vehicle_no} · {claim.insurer_name}</p></div>
    <CustomerClaimStageStrip claimId={claim.id} accountId={account.id} selectedKey={selected.key} currentKey={INTERNAL_JOURNEY_STAGES[currentIndex]?.key || "spot_intimation"} completedKeys={INTERNAL_JOURNEY_STAGES.filter((stage,i)=>external?projection?.stages.some(x=>x.key===stage.key&&x.completed):i<(internal_projection?.completedStageCount??0)).map(stage=>stage.key)} />
    <section className="overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white">
      <h2 className="border-b border-[#D9E3F0] px-5 py-4 text-[17px] font-semibold text-[#071D49]">{selected.key==="spot_intimation"?"Accident & Spot Intimation Details":selected.label+" Details"}</h2>
      {selected.key==="spot_intimation" ? (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          {([
            ["Accident Date & Time",claim.accident_at],
            ["Spot Intimation Date & Time",claim.spot_intimation_at||(typeof milestone?.details?.spot_intimation_at==="string"?milestone.details.spot_intimation_at:null)],
            ["Driver Name",milestone?.details?.driver_name||(claim.accident_description?.match(/Driver:\\s*([^\\n]+)/)?.[1]??null)],
            ["Driver Number",milestone?.details?.driver_phone||(claim.accident_description?.match(/Driver phone:\\s*([^\\n]+)/)?.[1]??null)],
            ["Location",claim.accident_location||milestone?.details?.location],
          ] as Array<[string,unknown]>).map(([label,value])=><div key={label} className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label}</p>
            <div className="flex min-h-10 items-center overflow-hidden rounded-md border border-[#D9E3F0] bg-white px-3 text-[12px] font-medium text-[#071D49]">
              <span className="truncate" title={typeof value==="string"?value:""}>{typeof value==="string"&&value?(label.includes("Date")?new Date(value).toLocaleString("en-IN"):value):"—"}</span>
            </div>
          </div>)}
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
    </section>
    {external && claim.claim_service_mode==="self_managed" && claim.assistance_status!=="accepted" && CUSTOMER_EXTERNAL_STAGE_FIELDS[selected.key] ? (
      <form action={saveCustomerExternalStage} className="grid gap-3 rounded-xl border border-[#DFE8F4] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <h2 className="text-lg font-black text-[#10213D] sm:col-span-2">Update {selected.label}</h2>
        <input type="hidden" name="account" value={account.id}/>
        <input type="hidden" name="claim" value={claim.id}/>
        <input type="hidden" name="stage" value={selected.key}/>
        {CUSTOMER_EXTERNAL_STAGE_FIELDS[selected.key].map(field=>(
          <label key={field.key} className="text-sm font-bold text-[#142746]">{field.label}{field.optional?"":" *"}
            {field.type==="boolean"||field.type==="yesno"?(
              <select required name={field.key} defaultValue={typeof milestone?.details?.[field.key]==="boolean"?String(milestone.details[field.key]):typeof milestone?.details?.[field.key]==="string"?String(milestone.details[field.key]):""} className="mt-2 block w-full rounded-xl border p-3 text-sm"><option value="">Select</option>{(field.type==="boolean"?[["true","Yes"],["false","No"]]:[["yes","Yes"],["no","No"]]).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select>
            ):(
              <input name={field.key} type={field.type} required={!field.optional} maxLength={field.type==="number"?undefined:500} min={field.type==="number"?"0":undefined} step={field.type==="number"?"0.01":undefined} defaultValue={typeof milestone?.details?.[field.key]==="string"||typeof milestone?.details?.[field.key]==="number"?String(milestone.details[field.key]):""} className="mt-2 block w-full rounded-xl border p-3 text-sm"/>
            )}
          </label>
        ))}
        <button type="submit" className="rounded-xl bg-[#0B3884] px-5 py-3 text-sm font-black text-white sm:col-span-2">Save {selected.label}</button>
      </form>
    ):null}
    <CustomerClaimEvidenceWorkspace documents={documents} claimId={claim.id} accountId={account.id} stage={selected.key}/>
  </div>;
}
