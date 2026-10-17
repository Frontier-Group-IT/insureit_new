"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireCapability } from "@/lib/master-data-server";

const allowedReviewRoles = new Set(["super_admin", "it_super_user", "sales_head", "sales_operations_head"]);

export async function reviewExchangeListing(formData: FormData) {
  const profile = await requireCapability("review_exchange_listings", "approve");
  if (!allowedReviewRoles.has(String(profile.role))) throw new Error("Exchange listing review access required.");

  const listingId = String(formData.get("listing_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const approve = decision === "approve";

  if (!listingId || (decision !== "approve" && decision !== "reject")) {
    throw new Error("A valid Exchange review decision is required.");
  }
  if (!approve && !notes) {
    throw new Error("Please enter a rejection reason before rejecting the listing.");
  }

  const scoreRaw = String(formData.get("inspection_score") ?? "").trim();
  const inspectionScore = scoreRaw ? Number(scoreRaw) : null;
  if (inspectionScore !== null && (!Number.isInteger(inspectionScore) || inspectionScore < 0 || inspectionScore > 100)) {
    throw new Error("Inspection score must be a whole number between 0 and 100.");
  }

  const supabase = await createServerSupabaseClient();
  const reviewRpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message?: string } | null }>;
  const { error } = await reviewRpc("exchange_review_listing", {
    p_listing_id: listingId,
    p_approve: approve,
    p_notes: notes || null,
    p_auction_ends_at: null,
    p_document_verified: formData.get("document_verified") === "1",
    p_inspection_score: inspectionScore,
  });

  if (error) throw new Error(error.message || "Exchange listing review could not be completed.");

  revalidatePath("/exchange/listings");
}

/**
 * Visibility is a distinct IT-only publication override.
 * Normal review roles cannot change it, even by invoking this action directly.
 */
export async function setExchangeListingVisibility(listingId: string, enabled: boolean) {
  const profile = await requireCapability("review_exchange_listings", "approve");
  if (String(profile.role) !== "it_super_user") {
    throw new Error("Only IT Super User can change Exchange listing visibility.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)
    || typeof enabled !== "boolean") {
    throw new Error("Invalid Exchange listing visibility request.");
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("exchange_listings")
    .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .in("status", ["pending_review", "live", "rejected"])
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Listing not found or unavailable.");
  revalidatePath("/exchange/listings");
  revalidatePath("/customer/exchange");
  revalidatePath(`/customer/exchange/${listingId}`);
  return { ok: true };
}


const listingUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function requireItExchangeManager() {
  const profile = await requireCapability("review_exchange_listings", "approve");
  if (String(profile.role) !== "it_super_user") throw new Error("Only IT Super User can manage Exchange listing actions.");
}
export async function updateExchangeListingDetails(listingId: string, values: { title: string; askingPrice: number; odometerKm: number | null; city: string; state: string }) {
  await requireItExchangeManager();
  if (!listingUuid.test(listingId) || !values.title.trim() || values.title.length > 180 || !Number.isFinite(values.askingPrice) || values.askingPrice <= 0 || (values.odometerKm !== null && (!Number.isSafeInteger(values.odometerKm) || values.odometerKm < 0))) throw new Error("Enter valid listing details.");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("exchange_listings").update({
    title: values.title.trim(), asking_price: values.askingPrice, odometer_km: values.odometerKm,
    city: values.city.trim() || null, state: values.state.trim() || null, updated_at: new Date().toISOString(),
  }).eq("id", listingId).in("status", ["pending_review","live","rejected"]).select("id").maybeSingle();
  if (error || !data) throw new Error(error?.message || "Listing not found.");
  revalidatePath("/exchange/listings");
  revalidatePath("/customer/exchange");
}
export async function permanentlyDeleteExchangeListing(listingId: string) {
  await requireItExchangeManager();
  if (!listingUuid.test(listingId)) throw new Error("Invalid listing ID.");
  const admin = createSupabaseAdminClient();
  const { data: listing, error: fetchError } = await admin.from("exchange_listings").select("id,listing_no").eq("id",listingId).in("status",["pending_review","live","rejected"]).maybeSingle();
  if (fetchError || !listing) throw new Error("Listing not found.");
  // Refuse deletion with business-history dependents. Do not cascade bids/deals/requests.
  for (const table of ["exchange_bids","exchange_contact_requests","exchange_deals"] as const) {
    const { count, error } = await admin.from(table).select("id",{head:true,count:"exact"}).eq("listing_id",listingId);
    if (error) throw new Error("Could not verify listing dependencies.");
    if (count) throw new Error("This listing has bids, contact requests, or deals and cannot be permanently deleted.");
  }
  const { data: media, error: mediaError } = await admin.from("exchange_listing_media").select("storage_bucket,storage_path").eq("listing_id",listingId);
  if (mediaError) throw new Error("Unable to verify listing files.");
  const {error: deleteError} = await admin.from("exchange_listings").delete().eq("id",listingId).select("id").single();
  if (deleteError) throw new Error(deleteError.message || "Unable to delete listing; linked records may exist.");
  // Delete only storage objects belonging to the deleted listing. Never touch vehicles or customers.
  const byBucket = new Map<string,string[]>();
  for (const item of media ?? []) if (item.storage_bucket && item.storage_path) byBucket.set(item.storage_bucket,[...(byBucket.get(item.storage_bucket)??[]),item.storage_path]);
  for (const [bucket,paths] of byBucket) {
    const {error} = await admin.storage.from(bucket).remove(paths);
    if (error) console.error("Exchange listing orphaned media cleanup failed", {listingId,bucket,code:error.message});
  }
  revalidatePath("/exchange/listings");
  revalidatePath("/customer/exchange");
  return {deleted:true};
}
