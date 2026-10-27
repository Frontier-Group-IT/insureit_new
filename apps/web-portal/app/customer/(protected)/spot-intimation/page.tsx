import { redirect } from "next/navigation";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { CustomerClaimStageStrip } from "@/components/customer-portal/customer-claim-stage-strip";
import { CustomerClaimEvidenceWorkspace } from "@/components/customer-portal/customer-claim-evidence-workspace";
import { CustomerClaimVoiceRecorder } from "@/components/customer-portal/customer-claim-voice-recorder";
import { SpotIntimationSaveForm, type SpotSaveState } from "./spot-intimation-save-form";
import { AutoCloseTimeInput } from "@/components/customer-portal/auto-close-time-input";

export const dynamic="force-dynamic";

function dateTime(form: FormData, name: string) {
  const date=String(form.get(name+"Date") || "");
  const time=String(form.get(name+"Time") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("A valid date and time is required");
  const timestamp=new Date(date+"T"+time+":00");
  if (!Number.isFinite(timestamp.getTime()) || timestamp.getTime()>Date.now()) throw new Error("Date and time must be valid and not in the future");
  return timestamp;
}

export default async function CustomerSpotIntimation({searchParams}:{searchParams?:Promise<{account?:string;id?:string}>}) {
  const q=searchParams?await searchParams:{};
  const {account}=await resolveCustomerWebScope(q.account);
  if(!q.id) redirect("/customer/start-claim?account="+encodeURIComponent(account.id));
  const {claim,documents}=await loadCustomerClaimDetail(account.id,q.id);
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
    let db: Awaited<ReturnType<typeof createServerSupabaseClient>>;
    try { db=await createServerSupabaseClient(); }
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
      redirect("/customer/claims?account="+encodeURIComponent(authorized.id));
    }
    redirect("/customer/claims/"+encodeURIComponent(owned.id)+"/stage/spot_status?account="+encodeURIComponent(authorized.id));
  }

  const textFieldClass = "block h-[42px] w-full min-w-0 rounded-lg border border-[#CAD8EA] bg-white px-3 text-[13px] font-medium text-[#193659] outline-none transition placeholder:text-[#95A3B8] focus-visible:border-[#2D7FF0] focus-visible:ring-2 focus-visible:ring-[#DCEBFF]";
  const splitFieldClass = "block h-[42px] min-w-0 flex-1 bg-transparent px-3 text-[13px] font-medium text-[#193659] outline-none";
  return <div className="mx-auto w-full max-w-[90rem] space-y-3">
    <CustomerClaimStageStrip claimId={claim.id} accountId={account.id} selectedKey="spot_intimation" currentKey="spot_intimation" completedKeys={[]}/>
    <SpotIntimationSaveForm action={submit} draftKey={account.id+":"+claim.id} cancelHref={`/customer/start-claim?account=${encodeURIComponent(account.id)}`} evidence={<><CustomerClaimEvidenceWorkspace documents={documents} claimId={claim.id} accountId={account.id} stage="spot_intimation" returnToSpotIntimation/><CustomerClaimVoiceRecorder claimId={claim.id} accountId={account.id}/></>}>
      <input type="hidden" name="account" value={account.id}/><input type="hidden" name="claim" value={claim.id}/>
      <div className="-mx-4 -mt-4 border-b border-[#D8E3F1] px-4 py-3 sm:-mx-5 sm:-mt-5 sm:px-5">
        <h2 className="text-[17px] font-bold text-[#112B51]">Accident &amp; Spot Intimation Details</h2>
      </div>
      <div className="grid gap-x-2.5 gap-y-3 pt-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_1.15fr_.8fr_1.35fr]">
        <label className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[.025em] text-[#245BB2]">Accident Date &amp; Time <span className="text-rose-500">*</span></span>
          <span className="mt-2 flex min-w-0 overflow-hidden rounded-lg border border-[#CAD8EA] bg-white">
            <input name="accidentDate" type="date" required aria-label="Accident date" className={splitFieldClass}/>
            <span aria-hidden="true" className="my-1.5 w-px shrink-0 bg-[#D6E0ED]"/>
            <AutoCloseTimeInput name="accidentTime" required ariaLabel="Accident time" className={splitFieldClass}/>
          </span>
        </label>
        <label className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[.025em] text-[#245BB2]">Spot Intimation Date &amp; Time <span className="text-rose-500">*</span></span>
          <span className="mt-2 flex min-w-0 overflow-hidden rounded-lg border border-[#CAD8EA] bg-white">
            <input name="spotDate" type="date" required aria-label="Spot intimation date" className={splitFieldClass}/>
            <span aria-hidden="true" className="my-1.5 w-px shrink-0 bg-[#D6E0ED]"/>
            <AutoCloseTimeInput name="spotTime" required ariaLabel="Spot intimation time" className={splitFieldClass}/>
          </span>
        </label>
        <label className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[.025em] text-[#245BB2]">Driver Name <span className="text-rose-500">{external?"":"*"}</span></span>
          <input name="driver" required={!external} maxLength={120} placeholder="Enter driver name" autoComplete="name" className={"mt-2 "+textFieldClass}/>
        </label>
        <label className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[.025em] text-[#245BB2]">Driver Number <span className="text-rose-500">{external?"":"*"}</span></span>
          <input name="phone" required={!external} type="tel" maxLength={15} inputMode="tel" placeholder="Enter mobile number" autoComplete="tel" className={"mt-2 "+textFieldClass}/>
        </label>
        <label className="min-w-0 md:col-span-2 xl:col-span-1">
          <span className="block text-[10px] font-bold uppercase tracking-[.025em] text-[#245BB2]">Location <span className="text-rose-500">{external?"":"*"}</span></span>
          <input name="location" required={!external} maxLength={500} placeholder="Enter accident location" className={"mt-2 "+textFieldClass}/>
        </label>
      </div>
    </SpotIntimationSaveForm>

  </div>;
}
