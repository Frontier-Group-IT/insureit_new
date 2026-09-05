import { NextResponse } from "next/server";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireCapability("view_claims");
  if (!profile?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: claim, error } = await admin
    .from("claims")
    .select("id,customer_id,current_status,accident_at,spot_intimation_at,accident_location,accident_description,updated_at")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      customer_id: string;
      current_status: string;
      accident_at: string | null;
      spot_intimation_at: string | null;
      accident_location: string | null;
      accident_description: string | null;
      updated_at: string | null;
    }>();

  if (error || !claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (!(await canAccessCustomer(profile.id, profile.role, claim.customer_id, "view_claims"))) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const [{ data: stage }, { data: milestone }] = await Promise.all([
    admin
      .from("claim_stage_details")
      .select("created_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string }>(),
    admin
      .from("claim_milestones")
      .select("created_at,completed_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string; completed_at: string | null }>(),
  ]);

  const version = JSON.stringify({
    current_status: claim.current_status,
    accident_at: claim.accident_at,
    spot_intimation_at: claim.spot_intimation_at,
    accident_location: claim.accident_location,
    accident_description: claim.accident_description,
    updated_at: claim.updated_at,
    stage_created_at: stage?.created_at ?? null,
    milestone_created_at: milestone?.created_at ?? null,
    milestone_completed_at: milestone?.completed_at ?? null,
  });

  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
