"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/auth-server";
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
  const { error } = await (supabase.rpc as any)("exchange_review_listing", {
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
