import { CustomerDateInput } from "@/components/customer-portal/customer-date-input";
import "../claims/[id]/stage/[stage]/customer-claim-reference.css";
import { redirect } from "next/navigation";
import { saveCustomerInternalSpotCorrection } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/actions";
import { isExternalCustomerClaim } from "@/lib/customer-web-phase2-data";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";
import { createCustomerServerSupabaseClient } from "@/lib/auth-server";
import { CustomerClaimStageStrip } from "@/components/customer-portal/customer-claim-stage-strip";
import { CustomerClaimEvidenceWorkspace } from "@/components/customer-portal/customer-claim-evidence-workspace";
import { CustomerClaimVoiceRecorder } from "@/components/customer-portal/customer-claim-voice-recorder";
import { SpotIntimationSaveForm, type SpotSaveState } from "./spot-intimation-save-form";
import { saveCustomerSpotDraft, type SpotDraftFields } from "./draft-actions";
import { AutoCloseTimeInput } from "@/components/customer-portal/auto-close-time-input";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { findExistingLinkedClaimCopy, findLinkedClaimPolicyCopy } from "@/lib/linked-claim-policy-copy";

export const dynamic="force-dynamic";

function dateTime(form: FormData, name: string) {
  const date=String(form.get(name+"Date") || "");
  const time=String(form.get(name+"Time") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("A valid date and time is required");
  const timestamp=new Date(date+"T"+time+":00");
  if (!Number.isFinite(timestamp.getTime()) || timestamp.getTime()>Date.now()) throw new Error("Date and time must be valid and not in the future");
  return timestamp;
}

export default async function CustomerSpotIntimation({searchParams}:{searchParams?:Promise<{account?:string;id?:string;mode?:string}>}) {
  const q=searchParams?await searchParams:{};
  const {account}=await resolveCustomerWebScope(q.account);
  if(!q.id) redirect("/customer/start-claim?account="+encodeURIComponent(account.id));
  const {claim,documents,milestones,internal_projection}=await loadCustomerClaimDetail(account.id,q.id);
  const editing=q.mode==="edit";
  const draftDb = await createCustomerServerSupabaseClient();
  const draftQuery = claim.current_status === "Draft"
    ? await draftDb.from("claim_spot_intimation_drafts").select("fields, updated_at").eq("claim_id", claim.id).eq("customer_id", account.id).maybeSingle<{ fields: SpotDraftFields; updated_at: string }>()
    : null;
  const serverDraft = draftQuery?.data ? { fields: draftQuery.data.fields, updatedAt: draftQuery.data.updated_at } : null;
  const stageTwoComplete=(internal_projection?.completedStageCount??0)>=2 || milestones.some(item=>item.milestone_key==="claim_intimation" && ["completed","not_applicable"].includes(item.milestone_status));
  const eligible=editing && !isExternalCustomerClaim(claim) && claim.claim_service_mode==="broker_managed" &&
    (internal_projection?.completedStageCount??0)>=1 && !stageTwoComplete;
  const detailsHref="/customer/claims/"+encodeURIComponent(claim.id)+"/stage/spot_intimation?account="+encodeURIComponent(account.id);
  if(editing && !eligible) redirect(detailsHref);
  const spotDetails=milestones.find(m=>m.milestone_key==="spot_intimation")?.details;
  const description=claim.accident_description??"";
  const driverName=typeof spotDetails?.driver_name==="string"?spotDetails.driver_name:description.match(/Driver:\s*([^\n]+)/)?.[1]??"";
  const driverPhone=typeof spotDetails?.driver_phone==="string"?spotDetails.driver_phone:description.match(/Driver phone:\s*([^\n]+)/)?.[1]??"";
  const existingDateTime=(input:string|null|undefined,field:"date"|"time")=>{
    if(!input)return "";
    const date=new Date(input);
    if(!Number.isFinite(date.getTime()))return "";
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
    const get=(key:string)=>parts.find(part=>part.type===key)?.value??"";
    return field==="date"?get("year")+"-"+get("month")+"-"+get("day"):get("hour")+":"+get("minute");
  };
  async function submitCorrection(_state:SpotSaveState,form:FormData):Promise<SpotSaveState>{
    "use server";
    const update=new FormData();
    update.set("account",String(form.get("account")??""));
    update.set("claim",String(form.get("claim")??""));
    update.set("accidentAt",String(form.get("accidentDate")??"")+"T"+String(form.get("accidentTime")??""));
    update.set("spotAt",String(form.get("spotDate")??"")+"T"+String(form.get("spotTime")??""));
    for(const key of ["driver","phone","location"])update.set(key,String(form.get(key)??""));
    const result=await saveCustomerInternalSpotCorrection({error:null,saved:false},update);
    if(!result.saved)return {error:result.error??"Changes could not be saved."};
    return {error:null,destination:"/customer/claims/"+encodeURIComponent(String(form.get("claim")??""))+"/stage/spot_intimation?account="+encodeURIComponent(String(form.get("account")??""))};
  }
  const external=Boolean(claim.external_policy_id);
  async function submit(_state: SpotSaveState, form:FormData): Promise<SpotSaveState> {
    "use server";
    const customerId=String(form.get("account")||"");
    const claimId=String(form.get("claim")||"");
    let authorized: Awaited<ReturnType<typeof resolveCustomerWebScope>>["account"];
    let owned: Awaited<ReturnType<typeof loadCustomerClaimDetail>>["claim"];
    try {
      ({account:authorized}=await resolveCustomerWebScope(customerId));
      ({claim:owned}=await loadCustomerClaimDetail(authorized.id,claimId));
    } catch (error) {
      console.error("Customer Spot Intimation scope/load failed",error);
      return {error:"We could not verify this claim. Please reload the page and try again."};
    }
    let incident: Date;
    let spot: Date;
    try { incident=dateTime(form,"accident"); spot=dateTime(form,"spot"); }
    catch { return {error:"Enter valid accident and spot intimation dates and times (not in the future)."}; }
    if(spot.getTime()<incident.getTime()) return {error:"Spot intimation cannot be earlier than the accident."};
    const driver=String(form.get("driver")||"").trim().slice(0,120);
    const phone=String(form.get("phone")||"").trim();
    const location=String(form.get("location")||"").trim().slice(0,500);
    if(phone && !/^\+?[0-9 ]{10,15}$/.test(phone)) return {error:"Enter a valid driver phone number."};
    let db: Awaited<ReturnType<typeof createCustomerServerSupabaseClient>>;
    try { db=await createCustomerServerSupabaseClient(); }
    catch (error) { console.error("Customer Spot Intimation database connection failed",error); return {error:"Unable to connect to claim service. Please try again."}; }
    try {
    if(owned.external_policy_id) {
      if(owned.claim_service_mode==="broker_managed") {
        if(owned.current_status!=="Draft") return {error:"This claim has already progressed. Open Claim Details to continue."};
        const {data:brokerSaved,error:brokerError}=await db.from("claims").update({
          current_status:"Initial Documents Pending",accident_at:incident.toISOString(),
          spot_intimation_at:spot.toISOString(),accident_location:location||null,
          accident_description:[driver&&"Driver: "+driver,phone&&"Driver phone: "+phone].filter(Boolean).join("\n")||null,
        }).eq("id",owned.id).eq("customer_id",authorized.id).eq("current_status","Draft").eq("claim_service_mode","broker_managed").select("id").maybeSingle();
        if(brokerError || !brokerSaved?.id) {
          console.error("Customer broker-managed spot submission failed",{code:brokerError?.code,message:brokerError?.message});
          return {error:"Spot Intimation could not be saved for this claim. Please contact support if the problem persists."};
        }
      } else {
      const {error}=await db.rpc("finalize_self_managed_external_claim_draft",{
        p_claim_id:owned.id,p_accident_at:incident.toISOString(),p_spot_intimation_at:spot.toISOString(),
        p_driver_name:driver||null,p_driver_phone:phone||null,p_location:location||null,
      });
      if(error) return {error:"Spot Intimation could not be saved. Please try again."};
      }
    } else {
      if(owned.current_status!=="Draft") return {error:"This claim is already in progress. Open Claim Details to review it."};
      if(!driver || !phone || !location) return {error:"Driver name, number and accident location are required."};
      const {data,error}=await db.from("claims").update({
        current_status:"Initial Documents Pending",accident_at:incident.toISOString(),
        spot_intimation_at:spot.toISOString(),accident_location:location,
        accident_description:"Driver: "+driver+"\nDriver phone: "+phone,
      }).eq("id",owned.id).eq("customer_id",authorized.id).eq("current_status","Draft").select("id").single();
      if(error || !data?.id) return {error:"Claim submission could not be completed. Please check Claim Details before retrying."};
    }
    } catch (error) {
      console.error("Customer Spot Intimation save failed unexpectedly",error);
      return {error:"Your claim could not be saved. Please check Claim Details before trying again."};
    }
    if (!owned.external_policy_id) {
      return {error:null,destination:"/customer/claims?account="+encodeURIComponent(authorized.id)};
    }
    return {error:null,destination:"/customer/claims/"+encodeURIComponent(owned.id)+"/stage/spot_status?account="+encodeURIComponent(authorized.id)};
  }

  const textFieldClass = "block h-[42px] w-full min-w-0 rounded-[4px] border border-[#CAD8EA] bg-white px-3 text-[13px] font-medium text-[#193659] outline-none transition placeholder:text-[#95A3B8] focus-visible:border-[#2D7FF0] focus-visible:ring-2 focus-visible:ring-[#DCEBFF]";
  const splitFieldClass = "block h-[34px] min-w-0 flex-[2_1_0%] self-center bg-transparent px-1.5 text-[13px] font-medium text-[#193659] outline-none";
  // The exact customer-owned linked policy copy is offered without duplicating
  // an already-attached claim file.
  const copyAdmin = createSupabaseAdminClient();
  const availablePolicyCopy = await findLinkedClaimPolicyCopy(copyAdmin, claim).catch(() => null);
  const canReusePolicyCopy = availablePolicyCopy
    ? !(await findExistingLinkedClaimCopy(copyAdmin, claim.id, account.id, availablePolicyCopy).catch(() => true))
    : false;
  // Resolve legacy claims from the actual linked policy when the stored source is null.
  // External linkage takes priority, matching the Customer Claim Journey details page.
  const policySource=claim.policy_service_source==="external"||Boolean(claim.external_policy_id)
    ?"External Policy"
    :claim.policy_service_source==="sibl"||Boolean(claim.policy_id)
      ?"Sankalp Policy"
      :"—";
  return <div className="mx-auto w-full max-w-[90rem] space-y-3">
    <CustomerClaimStageStrip claimId={claim.id} accountId={account.id} centerSummaryIcons hideStageNav selectedKey="spot_intimation" currentKey="spot_intimation" completedKeys={editing?["spot_intimation"]:[]} claimSummary={{controlNo:claim.claim_no,policyNo:claim.policy_no,makeModel:[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" - ")||null,vehicleNo:claim.vehicle_no,status:claim.current_status,manufacturer:claim.vehicle_make,insurer:claim.insurer_name,policySource}}/>
    <SpotIntimationSaveForm action={editing?submitCorrection:submit} editMode={editing} serverDraft={serverDraft} saveServerDraft={claim.current_status === "Draft" ? saveCustomerSpotDraft.bind(null, account.id, claim.id) : undefined} draftKey={account.id+":"+claim.id+(editing?":edit":"")} cancelHref={editing?detailsHref:`/customer/start-claim?account=${encodeURIComponent(account.id)}`} evidence={<><CustomerClaimEvidenceWorkspace documents={documents} claimId={claim.id} accountId={account.id} stage="spot_intimation" canReusePolicyCopy={canReusePolicyCopy} returnToSpotIntimation/><CustomerClaimVoiceRecorder claimId={claim.id} accountId={account.id} documents={documents}/></>}>
      <input type="hidden" name="account" value={account.id}/><input type="hidden" name="claim" value={claim.id}/>
      <div className="-mx-4 -mt-1 border-b border-[#D8E3F1] px-4 py-2 sm:-mx-5 sm:-mt-1 sm:px-5">
        <h2 className="text-[14px] font-bold text-[#112B51]">Accident &amp; Spot Intimation Details</h2>
      </div>
      <div className="mt-4 grid min-w-0 gap-x-3 gap-y-4 py-2 md:grid-cols-2 lg:grid-cols-3 min-[1440px]:grid-cols-5 sm:py-3">
        <label className="min-w-0 w-full">
          <span className="block min-h-5 whitespace-nowrap text-[11px] font-bold uppercase leading-5 tracking-[0.01em] text-[#245BB2] max-sm:whitespace-normal">Accident Date &amp; Time <span className="text-rose-500">*</span></span>
          <span className="mt-1 flex h-[42px] w-full min-w-0 overflow-hidden rounded-[4px] border border-[#CAD8EA] bg-white">
            <CustomerDateInput compact splitTime name="accidentDate" label="Accident date" defaultValue={editing?existingDateTime(claim.accident_at,"date"):undefined} required className="text-[13px] font-medium text-[#193659]" />
            <span aria-hidden="true" className="my-1.5 w-px shrink-0 bg-[#D6E0ED]"/>
            <AutoCloseTimeInput name="accidentTime" defaultValue={editing?existingDateTime(claim.accident_at,"time"):undefined} required ariaLabel="Accident time" className={splitFieldClass}/>
          </span>
        </label>
        <label className="min-w-0 w-full">
          <span className="block min-h-5 whitespace-nowrap text-[11px] font-bold uppercase leading-5 tracking-[0.01em] text-[#245BB2] max-sm:whitespace-normal">Spot Intimation Date &amp; Time <span className="text-rose-500">*</span></span>
          <span className="mt-1 flex h-[42px] w-full min-w-0 overflow-hidden rounded-[4px] border border-[#CAD8EA] bg-white">
            <CustomerDateInput compact splitTime name="spotDate" label="Spot intimation date" defaultValue={editing?existingDateTime(claim.spot_intimation_at,"date"):undefined} required className="text-[13px] font-medium text-[#193659]" />
            <span aria-hidden="true" className="my-1.5 w-px shrink-0 bg-[#D6E0ED]"/>
            <AutoCloseTimeInput name="spotTime" defaultValue={editing?existingDateTime(claim.spot_intimation_at,"time"):undefined} required ariaLabel="Spot intimation time" className={splitFieldClass}/>
          </span>
        </label>
        <label className="min-w-0 w-full">
          <span className="block min-h-5 whitespace-nowrap text-[11px] font-bold uppercase leading-5 tracking-[0.01em] text-[#245BB2] max-sm:whitespace-normal">Driver Name <span className="text-rose-500">{external?"":"*"}</span></span>
          <input name="driver" defaultValue={editing?driverName:undefined} required={!external} maxLength={120} placeholder="Enter driver name" autoComplete="name" className={"mt-1 "+textFieldClass}/>
        </label>
        <label className="min-w-0 w-full">
          <span className="block min-h-5 whitespace-nowrap text-[11px] font-bold uppercase leading-5 tracking-[0.01em] text-[#245BB2] max-sm:whitespace-normal">Driver Number <span className="text-rose-500">{external?"":"*"}</span></span>
          <input name="phone" defaultValue={editing?driverPhone:undefined} required={!external} type="tel" maxLength={15} inputMode="tel" placeholder="Enter mobile number" autoComplete="tel" className={"mt-1 "+textFieldClass}/>
        </label>
        <label className="min-w-0 w-full md:col-span-2 lg:col-span-1">
          <span className="block min-h-5 whitespace-nowrap text-[11px] font-bold uppercase leading-5 tracking-[0.01em] text-[#245BB2] max-sm:whitespace-normal">Location <span className="text-rose-500">{external?"":"*"}</span></span>
          <input name="location" defaultValue={editing?claim.accident_location??"":undefined} required={!external} maxLength={500} placeholder="Enter accident location" className={"mt-1 "+textFieldClass}/>
        </label>
      </div>
    </SpotIntimationSaveForm>

  </div>;
}
