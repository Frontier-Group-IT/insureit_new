"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { createCustomerServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim } from "@/lib/customer-web-phase2-data";
import { CUSTOMER_EXTERNAL_STAGE_FIELDS } from "@/lib/customer-claim-stage-fields";

/** Confirm Stage 1 data is persisted before returning to the customer's claim register.
 * Stage 1 fields on the completed detail screen are read-only, and uploads are
 * saved by their own upload actions. Never fabricate a stage transition here.
 */
export async function confirmCustomerSpotIntimationSaved(form: FormData) {
  const accountId = String(form.get("account") || "");
  const claimId = String(form.get("claim") || "");
  const { account } = await resolveCustomerWebScope(accountId);
  const { claim } = await loadCustomerClaimDetail(account.id, claimId);
  if (claim.current_status === "Draft" || !claim.accident_at || !claim.spot_intimation_at) {
    throw new Error("Complete and save Spot Intimation details before returning to Claims.");
  }
  redirect("/customer/claims?account=" + encodeURIComponent(account.id));
}

/** Surface only known, actionable database errors; never expose raw SQL or authorization details. */
function claimStageDatabaseError(message: string | undefined): string {
  const detail = message ?? "";
  if (detail.includes("Delivery Order amount cannot exceed bill amount")) {
    return "Delivery Order amount cannot exceed the saved Bill Amount. Check the Billing stage and enter an amount up to the bill value.";
  }
  if (detail.includes("Only self-managed claims can be updated here") || detail.includes("This claim is now managed by Sankalp")) {
    return "This claim is not available for self-managed stage updates. Please contact support.";
  }
  if (detail.includes("Claim not available") || detail.includes("Authentication required")) {
    return "You no longer have access to save this claim. Please sign in again or contact support.";
  }
  return "Could not save claim stage";
}

const stageDates:Record<string,string>={
  spot_status:"spot_survey_done_date",claim_intimation:"claim_intimation_date",
  work_approval:"approval_received_date",repair_ri:"ri_done_date",
  billing:"bill_date",delivery_order:"do_date",vehicle_delivery:"vehicle_received_date",
  payment_encashment:"payment_received_date",
};

export async function saveCustomerExternalStage(form:FormData, navigate = true) {
  const accountId=String(form.get("account")||"");
  const claimId=String(form.get("claim")||"");
  const key=String(form.get("stage")||"");
  const config=CUSTOMER_EXTERNAL_STAGE_FIELDS[key];
  if(!config)throw new Error("Invalid claim stage");
  const {account}=await resolveCustomerWebScope(accountId);
  const {claim,milestones}=await loadCustomerClaimDetail(account.id,claimId);
  if(!isExternalCustomerClaim(claim))
    throw new Error("Claim stage editing is not available");
  const index=INTERNAL_JOURNEY_STAGES.findIndex(stage=>stage.key===key);
  if(index<1)throw new Error("Invalid stage");
  const previous=milestones.find(m=>m.milestone_key===INTERNAL_JOURNEY_STAGES[index-1].key);
  if(!previous||!["completed","not_applicable"].includes(previous.milestone_status))
    throw new Error("Complete the preceding claim stage first");
  const values:Record<string,string|number|boolean>={};
  for(const field of config){
    const value=String(form.get(field.key)||"").trim();
    if(!value){if(field.optional)continue;throw new Error("Complete all mandatory stage fields");}
    if(field.type==="number"){
      const amount=Number(value);
      if(!Number.isFinite(amount)||amount<0)throw new Error("Invalid monetary amount");
      values[field.key]=amount;
    }else if(field.type==="boolean"){
      if(!["true","false"].includes(value))throw new Error("Invalid choice");
      values[field.key]=value==="true";
    }else if(field.type==="yesno"){
      if(!["yes","no"].includes(value))throw new Error("Invalid choice");
      values[field.key]=value;
    }else{
      if(value.length>500)throw new Error("Value too long");
      if(field.type==="date"&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value>new Date().toISOString().slice(0,10)))throw new Error("Invalid stage date");
      values[field.key]=value;
    }
  }
  if(key==="vehicle_delivery"&&values.vehicle_received==="yes"&&!values.vehicle_received_date)
    throw new Error("Enter the vehicle received date");
  if(key==="repair_ri"&&values.ri_requested_date&&String(values.ri_requested_date)<String(values.repair_complete_date))
    throw new Error("RI requested date must not precede repair complete date");
  if(key==="repair_ri"&&values.ri_done_date&&String(values.ri_done_date)<String(values.repair_complete_date))
    throw new Error("RI done date must not precede repair complete date");
  if(key==="payment_encashment"&&values.payment_received_date&&values.documents_submit_date&&String(values.payment_received_date)<String(values.documents_submit_date))
    throw new Error("Payment date must not precede document submission");
  const dateKey=stageDates[key];
  const date=dateKey?values[dateKey]:null;
  if(typeof date==="string"&&previous.details){
    const prevKey=stageDates[previous.milestone_key]||"spot_intimation_at";
    const previousDate=previous.details[prevKey];
    if(typeof previousDate==="string"&&date<previousDate.slice(0,10))throw new Error("Stage date precedes the previous stage");
  }
  const db=await createCustomerServerSupabaseClient();
  const session=await getCustomerWebSession();
  const current=milestones.find(m=>m.milestone_key===key);
  const editingCompleted = Boolean(current && ["completed","not_applicable"].includes(current.milestone_status));
  if(key==="vehicle_delivery"||key==="spot_status"){
    const done=key!=="vehicle_delivery"||(values.vehicle_received==="yes"&&Boolean(values.vehicle_received_date));
    const {error}=await db.from("claim_milestones").upsert({
      claim_id:claim.id,milestone_key:key,milestone_status:done?"completed":"in_progress",
      details:values,completed_at:done?(current?.completed_at||new Date().toISOString()):null,
      recorded_by:session.user.id,recorded_by_actor:"customer",
    },{onConflict:"claim_id,milestone_key"});
    if(error){
      console.error("Customer claim stage save rejected", { stage: key, code: error.code, message: error.message });
      throw new Error(claimStageDatabaseError(error.message));
    }
  }else{
    if(key==="repair_ri")values.ri_required="yes";
    const {error}=await (db.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>)("save_self_managed_milestone",{
      p_claim_id:claim.id,p_milestone_key:key,p_details:values,
      p_completed_at:current?.completed_at||new Date().toISOString(),
    });
    if(error){
      console.error("Customer claim stage save rejected", { stage: key, code: error.code, message: error.message });
      throw new Error(claimStageDatabaseError(error.message));
    }
  }
  const next=INTERNAL_JOURNEY_STAGES[index+1];
  // Saving the final Payment Encashment stage returns to the customer's Claim Register,
  // including edits to an already-completed Stage 9. Preserve the scoped account.
  const destination = key === "payment_encashment"
    ? "/customer/claims?account="+encodeURIComponent(account.id)
    : editingCompleted
      ? "/customer/claims/"+encodeURIComponent(claim.id)+"/stage/"+encodeURIComponent(key)+"?account="+encodeURIComponent(account.id)+"&mode=edit&saved=updated"
      : next
        ? "/customer/claims/"+encodeURIComponent(claim.id)+"/stage/"+encodeURIComponent(next.key)+"?account="+encodeURIComponent(account.id)+"&mode=edit"+(key==="claim_intimation"?"&saved=claim_intimation":"")
        : "/customer/claims/"+encodeURIComponent(claim.id)+"?account="+encodeURIComponent(account.id);
  if (navigate) redirect(destination);
  return destination;
}

/**
 * Customer-only, optional insurer claim-number capture after the first successful
 * external Stage 3 completion. Do not advance milestones or replace an existing number.
 */
export async function saveCustomerExternalInsurerClaimNumber(
  accountId: string,
  claimId: string,
  rawNumber: string,
): Promise<{ error: string | null }> {
  const value = rawNumber.trim();
  if (!value || value.length > 80 || !/^[A-Za-z0-9][A-Za-z0-9./_#\\- ]*$/.test(value)) {
    return { error: "Enter a valid insurer claim number (up to 80 letters, digits or common separators)." };
  }
  try {
    const { account } = await resolveCustomerWebScope(accountId);
    const { claim, milestones } = await loadCustomerClaimDetail(account.id, claimId);
    if (!isExternalCustomerClaim(claim) || claim.claim_service_mode !== "self_managed") {
      return { error: "This claim does not allow customer insurer-number updates." };
    }
    const stageThree = milestones.find(row => row.milestone_key === "claim_intimation");
    if (!stageThree || !["completed", "not_applicable"].includes(stageThree.milestone_status)) {
      return { error: "Complete Claim Intimation before adding the insurer claim number." };
    }
    if (claim.insurer_claim_no?.trim()) {
      return { error: "An insurer claim number is already recorded. Contact support to correct it." };
    }
    const db = await createCustomerServerSupabaseClient();
    const { data, error } = await db.from("claims")
      .update({ insurer_claim_no: value })
      .eq("id", claim.id)
      .eq("customer_id", account.id)
      .is("insurer_claim_no", null)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Customer insurer claim-number update rejected", { code: error.code });
      return { error: "Unable to save the insurer claim number. Please try again." };
    }
    if (!data) {
      return { error: "The claim number was already updated or your access changed. Refresh and try again." };
    }
    revalidatePath("/customer/claims/" + encodeURIComponent(claim.id));
    return { error: null };
  } catch {
    return { error: "Unable to save the insurer claim number. Please try again." };
  }
}

/** Save incomplete Stage 3 details without completing the claim milestone. */
export async function saveCustomerClaimIntimationDraft(form: FormData, navigate = true) {
  const accountId = String(form.get("account") || "");
  const claimId = String(form.get("claim") || "");
  const key = String(form.get("stage") || "");
  if (key !== "claim_intimation") throw new Error("Draft saving is only available for Claim Intimation");
  const { account } = await resolveCustomerWebScope(accountId);
  const { claim, milestones } = await loadCustomerClaimDetail(account.id, claimId);
  if (!isExternalCustomerClaim(claim))
    throw new Error("Claim stage editing is not available");
  const index = INTERNAL_JOURNEY_STAGES.findIndex(stage => stage.key === key);
  const previous = milestones.find(m => m.milestone_key === INTERNAL_JOURNEY_STAGES[index - 1].key);
  const current = milestones.find(m => m.milestone_key === key);
  if (!previous || !["completed", "not_applicable"].includes(previous.milestone_status))
    throw new Error("Claim Intimation cannot be edited");
  const values: Record<string, string | number> = {};
  for (const field of CUSTOMER_EXTERNAL_STAGE_FIELDS[key]) {
    const value = String(form.get(field.key) || "").trim();
    if (!value) continue;
    if (value.length > 500) throw new Error("Value too long");
    if (field.type === "number") {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid monetary amount");
      values[field.key] = amount;
    } else {
      if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error("Invalid stage date");
      values[field.key] = value;
    }
  }
  const db = await createCustomerServerSupabaseClient();
  const session = await getCustomerWebSession();
  const { error } = await db.from("claim_milestones").upsert({
    claim_id: claim.id, milestone_key: key, milestone_status: current && ["completed","not_applicable"].includes(current.milestone_status) ? "completed" : "in_progress",
    details: { ...(current?.details ?? {}), ...values },
    completed_at: current?.completed_at ?? null, recorded_by: session.user.id, recorded_by_actor: "customer",
  }, { onConflict: "claim_id,milestone_key" });
  if (error) throw new Error("Could not save Claim Intimation draft");
  const destination = "/customer/claims/" + encodeURIComponent(claim.id) + "/stage/claim_intimation?account=" +
    encodeURIComponent(account.id) + "&mode=edit";
  if (navigate) redirect(destination);
  return destination;
}


/** Action boundary: user-correctable validation failures must not become RSC render errors. */
export async function saveCustomerClaimStageWithFeedback(mode: "draft" | "details", form: FormData): Promise<{error: string | null; destination?: string}> {
  try {
    const destination = mode === "draft"
      ? await saveCustomerClaimIntimationDraft(form, false)
      : await saveCustomerExternalStage(form, false);
    return {error:null, destination};
  } catch (error) {
    // Next.js redirects are thrown internally; preserve successful navigation.
    if (error && typeof error === "object" && "digest" in error &&
        typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    const reason = error instanceof Error ? error.message : "";
    if (reason === "Stage date precedes the previous stage") {
      return {error:"The stage date must be on or after the previous stage date. Check the entered date before saving."};
    }
    const safeMessages = [
      "Complete all mandatory stage fields", "Invalid stage date", "Invalid monetary amount",
      "Invalid choice", "Value too long", "RI requested date must not precede repair complete date",
      "RI done date must not precede repair complete date", "Payment date must not precede document submission",
      "Enter the vehicle received date", "Complete the preceding claim stage first",
      "Claim Intimation cannot be edited", "Claim stage editing is not available",
      "Could not save claim stage", "Could not save Claim Intimation draft",
      "Delivery Order amount cannot exceed the saved Bill Amount. Check the Billing stage and enter an amount up to the bill value.",
      "This claim is not available for self-managed stage updates. Please contact support.",
      "You no longer have access to save this claim. Please sign in again or contact support."
    ];
    return {error:safeMessages.includes(reason)?reason:"Unable to save claim details. Your entries are preserved; please try again."};
  }
}

/**
 * Customer Internal Claim Stage 1 corrections. Saving existing data never
 * advances workflow. The persisted Stage 2 completion is checked again at
 * submission time; disabling the Edit control alone is insufficient.
 */
export async function saveCustomerInternalSpotCorrection(
  _previous: { error: string | null; saved: boolean },
  form: FormData,
): Promise<{ error: string | null; saved: boolean }> {
  const fail = (error: string) => ({ error, saved: false });
  const { account } = await resolveCustomerWebScope(String(form.get("account") || ""));
  const claimId = String(form.get("claim") || "");
  const { claim, internal_projection, milestones } = await loadCustomerClaimDetail(account.id, claimId);
  if (isExternalCustomerClaim(claim) || claim.claim_service_mode !== "broker_managed" || !internal_projection || internal_projection.completedStageCount < 1) {
    return fail("Stage 1 corrections are not available for this claim.");
  }
  // Re-read persisted Stage 2 completion on every submission; a hidden button or
  // a previously opened edit form is not authorization to modify completed claims.
  const stageTwoComplete = internal_projection.completedStageCount >= 2 || milestones.some(
    item => item.milestone_key === "claim_intimation" && ["completed", "not_applicable"].includes(item.milestone_status),
  );
  if (stageTwoComplete) return fail("Spot Intimation is locked because Claim Intimation (Stage 2) is complete.");

  const accident = String(form.get("accidentAt") || "");
  const spot = String(form.get("spotAt") || "");
  // The browser submits local datetime values in the customer portal's IST timezone.
  const asKolkataDate = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(value + ":00+05:30") : new Date(NaN);
  const incidentDate = asKolkataDate(accident);
  const spotDate = asKolkataDate(spot);
  if (!accident || !spot || !Number.isFinite(incidentDate.getTime()) || !Number.isFinite(spotDate.getTime()) ||
    incidentDate.getTime() > Date.now() || spotDate.getTime() > Date.now() || spotDate < incidentDate)
    return fail("Enter valid accident and spot intimation dates. Spot intimation must not precede the accident.");

  const driver = String(form.get("driver") || "").trim().slice(0, 120);
  const phone = String(form.get("phone") || "").trim().slice(0, 15);
  const location = String(form.get("location") || "").trim().slice(0, 500);
  if (phone && !/^\+?[0-9 ]{10,15}$/.test(phone)) return fail("Enter a valid driver contact number.");

  const db = await createCustomerServerSupabaseClient();
  const { data, error } = await db.from("claims").update({
    accident_at: incidentDate.toISOString(),
    spot_intimation_at: spotDate.toISOString(),
    accident_location: location || null,
    accident_description: [driver && "Driver: " + driver, phone && "Driver phone: " + phone].filter(Boolean).join("\n") || null,
  }).eq("id", claim.id).eq("customer_id", account.id).eq("claim_service_mode", "broker_managed").select("id").maybeSingle();
  if (error || !data) {
    console.error("Customer Internal Stage 1 correction rejected", { code: error?.code ?? null });
    return fail("Stage 1 details could not be saved. Please reload and try again.");
  }
  revalidatePath("/customer/claims/" + encodeURIComponent(claim.id) + "/stage/spot_intimation");
  return { error: null, saved: true };
}
