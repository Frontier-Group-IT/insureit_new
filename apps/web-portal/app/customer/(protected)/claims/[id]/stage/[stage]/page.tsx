import Link from "next/link";
import { notFound } from "next/navigation";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { CUSTOMER_EXTERNAL_STAGE_FIELDS } from "@/lib/customer-claim-stage-fields";
import { saveCustomerExternalStage } from "./actions";
import { uploadCustomerClaimDocument } from "./upload-action";
import { Check, Circle, ArrowLeft, LockKeyhole, FileText } from "lucide-react";
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
    <section className="rounded-xl border bg-white p-3">
      <h2 className="text-lg font-black text-[#112A50]">{selected.label} status</h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-[#516683]">{completed?<Check className="h-5 w-5 text-green-600"/>:activeIndex===currentIndex?<Circle className="h-5 w-5 text-blue-500"/>:<LockKeyhole className="h-5 w-5 text-[#8392A6]"/>}{completed?"Completed":activeIndex===currentIndex?"Current stage":"Not completed"}</p>
      {external&&milestone?.details ? <dl className="mt-3 overflow-hidden rounded-lg border text-[11px]">{Object.entries(milestone.details).filter(([,value])=>typeof value==="string"||typeof value==="number").slice(0,12).map(([key,value])=><div key={key} className="grid grid-cols-[minmax(110px,35%)_1fr] border-b last:border-0"><dt className="bg-[#F3F7FC] px-3 py-2 font-bold uppercase text-[#75869A]">{key.replace(/_/g," ")}</dt><dd className="break-words px-3 py-2 font-semibold text-[#172E51]">{String(value)}</dd></div>)}</dl>:null}
      <div className="mt-5 border-t pt-4 text-xs leading-5 text-[#64758C]">{external?"Self-managed stages follow the Customer App's milestone history. Stage changes require the same validation and evidence safeguards as mobile.":"Internal claims are managed by Operations. Customers can review every stage but cannot change Operations-owned statuses."}</div>
    </section>
    {external && claim.claim_service_mode==="self_managed" && claim.assistance_status!=="accepted" && CUSTOMER_EXTERNAL_STAGE_FIELDS[selected.key] ? (
      <form action={saveCustomerExternalStage} className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
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
    <section className="rounded-2xl border bg-white p-5"><h2 className="flex items-center gap-2 text-sm font-black text-[#112A50]"><FileText className="h-4 w-4"/> Claim documents</h2><p className="mt-2 text-sm text-[#71829B]">{documents.length} document(s) linked to this claim.</p>
      <form action={uploadCustomerClaimDocument} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="account" value={account.id}/><input type="hidden" name="claim" value={claim.id}/><input type="hidden" name="stage" value={selected.key}/>
        <label className="text-xs font-bold text-[#183251]">Document type
          <select name="type" required className="mt-1 block w-full rounded-xl border p-3 text-sm">
            {["RC Copy","Insurance Copy","Driver Licence","GR / Load Bill","Accident Photo","Accident Video","Spot Intimation Attachment","Incident Voice Note","Estimate Copy","Fitness Copy","Spot Report"].map(type=><option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-[#183251]">File
          <input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.mp4,.mov,.webm,.m4a" className="mt-1 block w-full rounded-xl border p-2.5 text-xs"/>
        </label>
        <button className="self-end rounded-xl bg-[#164D94] px-5 py-3 text-xs font-black text-white">Upload</button>
      </form>
      <p className="mt-2 text-xs text-[#8490A0]">PDF/images/audio up to 5 MB; videos up to 50 MB. Uploaded files remain subject to Operations verification.</p></section>
  </div>;
}
