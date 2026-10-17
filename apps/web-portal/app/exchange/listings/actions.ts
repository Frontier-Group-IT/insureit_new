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
