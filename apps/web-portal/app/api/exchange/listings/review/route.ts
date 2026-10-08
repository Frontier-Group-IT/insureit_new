import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

const allowedReviewRoles = new Set(["super_admin", "it_super_user", "sales_head", "sales_operations_head"]);

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getServerAccessToken();
    const { profile } = await getAuthenticatedProfile(accessToken);
    if (!profile?.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!allowedReviewRoles.has(String(profile.role))) {
      return NextResponse.json({ error: "Exchange listing review access required." }, { status: 403 });
    }

    const body = await request.json() as {
      listingId?: string;
      decision?: "approve" | "reject";
      notes?: string;
      documentVerified?: boolean;
      inspectionScore?: number | null;
    };

    const listingId = String(body.listingId ?? "").trim();
    const decision = body.decision;
    const notes = String(body.notes ?? "").trim();
    const approve = decision === "approve";

    if (!listingId || (decision !== "approve" && decision !== "reject")) {
      return NextResponse.json({ error: "A valid Exchange review decision is required." }, { status: 400 });
    }
    if (!approve && !notes) {
      return NextResponse.json({ error: "Please enter a rejection reason before rejecting the listing." }, { status: 400 });
    }

    const inspectionScore = body.inspectionScore == null ? null : Number(body.inspectionScore);
    if (inspectionScore !== null && (!Number.isInteger(inspectionScore) || inspectionScore < 0 || inspectionScore > 100)) {
      return NextResponse.json({ error: "Inspection score must be a whole number between 0 and 100." }, { status: 400 });
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
      p_document_verified: Boolean(body.documentVerified),
      p_inspection_score: inspectionScore,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Exchange listing review could not be completed." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, status: approve ? "live" : "rejected" });
  } catch (error) {
    console.error("exchange_listing_review_api_failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Exchange listing review could not be completed." },
      { status: 500 },
    );
  }
}
