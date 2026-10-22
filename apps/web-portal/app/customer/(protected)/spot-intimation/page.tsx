import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardCheck } from "lucide-react";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { CustomerClaimLogo } from "@/components/customer-portal/customer-claim-logo";
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
  const {claim}=await loadCustomerClaimDetail(account.id,q.id);
  const external=Boolean(claim.external_policy_id);
  async function submit(_state: SpotSaveState, form:FormData): Promise<SpotSaveState> {
    "use server";
    const customerId=String(form.get("account")||"");
    const claimId=String(form.get("claim")||"");
    const {account:authorized}=await resolveCustomerWebScope(customerId);
    const {claim:owned}=await loadCustomerClaimDetail(authorized.id,claimId);
    let incident: Date;
    let spot: Date;
    try { incident=dateTime(form,"accident"); spot=dateTime(form,"spot"); }
    catch { return {error:"Enter valid accident and spot intimation dates and times (not in the future)."}; }
    if(spot.getTime()<incident.getTime()) return {error:"Spot intimation cannot be earlier than the accident."};
    const driver=String(form.get("driver")||"").trim().slice(0,120);
    const phone=String(form.get("phone")||"").trim();
    const location=String(form.get("location")||"").trim().slice(0,500);
    if(phone && !/^\+?[0-9 ]{10,15}$/.test(phone)) return {error:"Enter a valid driver phone number."};
    const db=await createServerSupabaseClient();
    if(owned.external_policy_id) {
      if(owned.claim_service_mode==="broker_managed") return {error:"This broker-managed claim cannot be submitted here."};
      const {error}=await db.rpc("finalize_self_managed_external_claim_draft",{
        p_claim_id:owned.id,p_accident_at:incident.toISOString(),p_spot_intimation_at:spot.toISOString(),
        p_driver_name:driver||null,p_driver_phone:phone||null,p_location:location||null,
      });
      if(error) return {error:"Spot Intimation could not be saved. Please try again."};
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
    redirect("/customer/claims/"+encodeURIComponent(owned.id)+"?account="+encodeURIComponent(authorized.id));
  }

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href={{pathname:"/customer/start-claim",query:{account:account.id}}} className="text-sm font-semibold text-[#29569A]">← Back to Start Claim</Link>
    <div className="rounded-2xl bg-[#0B3884] p-5 text-white">
      <div className="flex items-center justify-between border-b border-white/20 pb-3"><span className="flex items-center gap-2 text-sm font-bold"><img src="/assets/customer-claim/stages/spot_intimation.png" alt="" className="h-6 w-6 rounded-md bg-white object-contain p-0.5"/> Spot Intimation</span><span className="rounded-full bg-white/15 px-3 py-1 text-xs">{external?"Self-tracked claim":"Managed claim"}</span></div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2"><div className="flex items-center gap-3"><CustomerClaimLogo value={claim.vehicle_make} size={44}/><div><p className="text-sm font-bold">{claim.vehicle_no||"Vehicle"}</p><p className="text-xs text-white/80">{[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" · ")}</p></div></div><div className="flex items-center gap-3"><CustomerClaimLogo value={claim.insurer_name} kind="insurer" size={44}/><div><p className="text-sm font-bold">{claim.policy_no||"Policy"}</p><p className="text-xs text-white/80">{claim.insurer_name}</p></div></div></div>
    </div>
    <SpotIntimationSaveForm action={submit}>
      <input type="hidden" name="account" value={account.id}/><input type="hidden" name="claim" value={claim.id}/>
      <div><h1 className="flex items-center gap-2 text-lg font-black text-[#112B51]"><CalendarDays className="h-5 w-5 text-[#2860AD]"/> Incident Details</h1><p className="mt-1 text-xs text-[#73849B]">Accident date, time and first insurer intimation</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Accident date *<input name="accidentDate" type="date" required className="mt-2 block w-full rounded-xl border p-3"/></label>
        <label className="text-sm font-bold">Accident time *<input name="accidentTime" type="time" required className="mt-2 block w-full rounded-xl border p-3"/></label>
        <label className="text-sm font-bold">Spot Intimation date *<input name="spotDate" type="date" required className="mt-2 block w-full rounded-xl border p-3"/></label>
        <label className="text-sm font-bold">Spot Intimation time *<input name="spotTime" type="time" required className="mt-2 block w-full rounded-xl border p-3"/></label>
        <label className="text-sm font-bold">Driver name {external?"(optional)":"*"}<input name="driver" required={!external} maxLength={120} className="mt-2 block w-full rounded-xl border p-3"/></label>
        <label className="text-sm font-bold">Driver number {external?"(optional)":"*"}<input name="phone" required={!external} type="tel" maxLength={15} className="mt-2 block w-full rounded-xl border p-3"/></label>
        <label className="text-sm font-bold sm:col-span-2">Accident location {external?"(optional)":"*"}<textarea name="location" required={!external} maxLength={500} rows={3} className="mt-2 block w-full rounded-xl border p-3"/></label>
      </div>
    </SpotIntimationSaveForm>
    <p className="text-xs text-[#77869B]">Customer-only submission. Subsequent managed-claim stages are controlled by Operations; external claims use the self-tracked milestone contract.</p>
  </div>;
}
