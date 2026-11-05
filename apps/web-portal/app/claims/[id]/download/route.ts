import { NextResponse } from "next/server";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { renderCompletedClaimPdf } from "@/lib/completed-claim-pdf";

export const dynamic = "force-dynamic";

/** Operations' own authorized route. Never proxy through a Customer session or public URL. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCapability("view_claims");
  if (!profile?.id) return NextResponse.json({ error: "Access denied." }, { status: 403 });
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: claim, error } = await admin.from("claims")
    .select("id,customer_id,vehicle_id,policy_id,external_policy_id,insurance_company_id,claim_no,insurer_claim_no,current_status,policy_service_source,accident_at,spot_intimation_at,accident_location")
    .eq("id", id).maybeSingle();
  if (error || !claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  if (!(await canAccessCustomer(profile.id, profile.role, claim.customer_id, "view_claims")))
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });

  const [milestoneResult, documentResult] = await Promise.all([
    admin.from("claim_milestones").select("milestone_key,milestone_status,details").eq("claim_id", claim.id),
    admin.from("claim_documents").select("document_type").eq("claim_id", claim.id),
  ]);
  if (milestoneResult.error || documentResult.error)
    return NextResponse.json({ error: "Could not verify completed claim stages." }, { status: 503 });
  const milestones = milestoneResult.data ?? [];
  const completedKeys = new Set(milestones.filter(m => m.milestone_status === "completed" || m.milestone_status === "not_applicable").map(m => m.milestone_key));
  if (!INTERNAL_JOURNEY_STAGES.every(stage => completedKeys.has(stage.key)))
    return NextResponse.json({ error: "The claim form is available after all nine stages are completed." }, { status: 409 });

  const isExternal = claim.policy_service_source === "external" || Boolean(claim.external_policy_id);
  const [vehicleResult, policyResult] = await Promise.all([
    admin.from("vehicles").select("vehicle_no,make,model").eq("id", claim.vehicle_id).eq("customer_id", claim.customer_id).maybeSingle(),
    isExternal && claim.external_policy_id
      ? admin.from("external_policies").select("policy_no,insurance_company_id").eq("id", claim.external_policy_id).eq("customer_id", claim.customer_id).eq("vehicle_id", claim.vehicle_id).maybeSingle()
      : claim.policy_id
        ? admin.from("policies").select("policy_no,insurance_company_id").eq("id", claim.policy_id).eq("customer_id", claim.customer_id).eq("vehicle_id", claim.vehicle_id).maybeSingle()
        : Promise.resolve({data:null,error:null}),
  ]);
  if (vehicleResult.error || policyResult.error)
    return NextResponse.json({error:"Could not load claim particulars."},{status:503});
  const insurerId = claim.insurance_company_id ?? policyResult.data?.insurance_company_id;
  const insurerResult = insurerId
    ? await admin.from("insurance_companies").select("name").eq("id",insurerId).maybeSingle()
    : { data: null, error: null };
  if (insurerResult.error) return NextResponse.json({error:"Could not load insurer information."},{status:503});

  const detail = {
    claim_no: claim.claim_no,
    insurer_claim_no: claim.insurer_claim_no,
    current_status: claim.current_status,
    policy_service_source: claim.policy_service_source,
    external_policy_id: claim.external_policy_id,
    insurer_name: insurerResult.data?.name ?? null,
    policy_no: policyResult.data?.policy_no ?? null,
    vehicle_no: vehicleResult.data?.vehicle_no ?? null,
    vehicle_make: vehicleResult.data?.make ?? null,
    vehicle_model: vehicleResult.data?.model ?? null,
    accident_at: claim.accident_at,
    spot_intimation_at: claim.spot_intimation_at,
    accident_location: claim.accident_location,
  };
  try {
    return await renderCompletedClaimPdf(detail, milestones, documentResult.data ?? [], new URL(request.url).searchParams.get("preview") === "1");
  } catch {
    return NextResponse.json({error:"Unable to generate claim details PDF."},{status:500});
  }
}
