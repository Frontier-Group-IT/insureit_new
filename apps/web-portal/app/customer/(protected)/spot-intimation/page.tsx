import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ArrowLeft, MapPin, Clock3, UserRound } from "lucide-react";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { CustomerClaimLogo } from "@/components/customer-portal/customer-claim-logo";
import { CustomerClaimStageStrip } from "@/components/customer-portal/customer-claim-stage-strip";
import { CustomerClaimEvidenceWorkspace } from "@/components/customer-portal/customer-claim-evidence-workspace";
import { CustomerClaimVoiceRecorder } from "@/components/customer-portal/customer-claim-voice-recorder";
import { SpotIntimationSaveForm, type SpotSaveState } from "./spot-intimation-save-form";

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
    redirect("/customer/claims/"+encodeURIComponent(owned.id)+"/stage/spot_status?account="+encodeURIComponent(authorized.id));
  }

  const fieldClass = "mt-1.5 block h-10 w-full min-w-0 rounded-lg border border-[#D7E2F0] bg-white px-3 text-[13px] font-medium text-[#193659] outline-none transition focus-visible:border-[#2D7FF0] focus-visible:ring-2 focus-visible:ring-[#DCEBFF]";
  return <div className="mx-auto w-full max-w-[90rem] space-y-3">
    <div className="flex items-center">
      <Link href={{pathname:"/customer/start-claim",query:{account:account.id}}} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#29569A] hover:text-[#153E78]"><ArrowLeft className="h-4 w-4"/> Back to Start Claim</Link>
    </div>
    <section aria-label="Selected claim" className="overflow-hidden rounded-2xl bg-[#0C2F67] px-4 py-3 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-2">
        <h1 className="flex items-center gap-2 text-[16px] font-bold"><img src="/assets/customer-claim/stages/spot_intimation.png" alt="" className="h-6 w-6 rounded-md bg-white object-contain p-0.5"/> Spot Intimation</h1>
        <span className="text-[11px] text-white/70">Incident registration</span>
      </div>
      <div className="grid gap-3 pt-3 sm:grid-cols-2 sm:gap-5">
        <div className="flex min-w-0 items-center gap-3"><CustomerClaimLogo value={claim.vehicle_make} size={40}/><div className="min-w-0"><p className="truncate text-[13px] font-bold">{claim.vehicle_no||"Vehicle"}</p><p className="truncate text-[11px] text-white/75">{[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" · ")}</p></div></div>
        <div className="flex min-w-0 items-center gap-3"><CustomerClaimLogo value={claim.insurer_name} kind="insurer" size={40}/><div className="min-w-0"><p className="truncate text-[13px] font-bold">{claim.policy_no||"No linked policy"}</p><p className="truncate text-[11px] text-white/75">{claim.insurer_name||"Insurer not assigned"}</p></div></div>
      </div>
    </section>
    <CustomerClaimStageStrip claimId={claim.id} accountId={account.id} selectedKey="spot_intimation" currentKey="spot_intimation" completedKeys={[]}/>
    <SpotIntimationSaveForm action={submit} cancelHref={`/customer/start-claim?account=${encodeURIComponent(account.id)}`} evidence={<><CustomerClaimEvidenceWorkspace documents={documents} claimId={claim.id} accountId={account.id} stage="spot_intimation" returnToSpotIntimation/><CustomerClaimVoiceRecorder claimId={claim.id} accountId={account.id}/></>}>
      <input type="hidden" name="account" value={account.id}/><input type="hidden" name="claim" value={claim.id}/>
      <div className="flex items-center gap-2 border-b border-[#E5EDF6] pb-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EDF4FF] text-[#2860AD]"><CalendarDays className="h-5 w-5"/></span>
        <h2 className="text-[17px] font-bold text-[#112B51]">Incident Details</h2>
      </div>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold text-[#243C5F]"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#7389A9]"/>Accident date *</span><input name="accidentDate" type="date" required className={fieldClass}/></label>
        <label className="text-[12px] font-semibold text-[#243C5F]"><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-[#7389A9]"/>Accident time *</span><input name="accidentTime" type="time" required className={fieldClass}/></label>
        <label className="text-[12px] font-semibold text-[#243C5F]"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#7389A9]"/>Spot Intimation date *</span><input name="spotDate" type="date" required className={fieldClass}/></label>
        <label className="text-[12px] font-semibold text-[#243C5F]"><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-[#7389A9]"/>Spot Intimation time *</span><input name="spotTime" type="time" required className={fieldClass}/></label>
        <label className="text-[12px] font-semibold text-[#243C5F]"><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-[#7389A9]"/>Driver name {external?"(optional)":"*"}</span><input name="driver" required={!external} maxLength={120} placeholder="Enter driver name" autoComplete="name" className={fieldClass}/></label>
        <label className="text-[12px] font-semibold text-[#243C5F]"><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-[#7389A9]"/>Driver mobile {external?"(optional)":"*"}</span><input name="phone" required={!external} type="tel" maxLength={15} inputMode="tel" placeholder="Enter mobile number" autoComplete="tel" className={fieldClass}/></label>
        <label className="text-[12px] font-semibold text-[#243C5F] sm:col-span-2"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#7389A9]"/>Accident location {external?"(optional)":"*"}</span><textarea name="location" required={!external} maxLength={500} rows={2} placeholder="Enter accident location" className="mt-1.5 block min-h-[66px] w-full resize-y rounded-lg border border-[#D7E2F0] bg-white px-3 py-2 text-[13px] font-medium text-[#193659] outline-none transition focus-visible:border-[#2D7FF0] focus-visible:ring-2 focus-visible:ring-[#DCEBFF]"/></label>
      </div>
    </SpotIntimationSaveForm>
    <p className="text-[11px] text-[#77869B]">Your details will be securely submitted for claim processing. Claim status and next steps are available in Claim Details.</p>
  </div>;
}
