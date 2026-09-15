import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { listPartnerWebClaims, type PartnerClaimRow } from "@/lib/partner-web";
import { PartnerClaimsPortfolio, type PartnerClaimPortfolioRow } from "./claims-portfolio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BATCH_SIZE = 200;
const MAX_ROWS = 5000;

type ClaimEnrichmentRow = {
  id: string;
  policy_service_source: string | null;
  customers: { company_name: string | null; contact_name: string | null; phone: string | null } | null;
  vehicles: { vehicle_no: string | null; make: string | null; model: string | null } | null;
};

async function loadScopedPartnerClaims() {
  const rows: PartnerClaimRow[] = [];
  let offset = 0;
  let total = 1;

  while (offset < total && rows.length < MAX_ROWS) {
    const batch = await listPartnerWebClaims({ limit: BATCH_SIZE, offset, state: "all" });
    if (offset === 0) total = Math.min(batch[0]?.total_count ?? batch.length, MAX_ROWS);
    if (!batch.length) break;
    rows.push(...batch);
    offset += batch.length;
  }

  return rows;
}

export default async function PartnerClaimsPage() {
  const scopedRows = await loadScopedPartnerClaims();
  const claimIds = scopedRows.map((row) => row.claim_id);
  const enrichmentById = new Map<string, ClaimEnrichmentRow>();

  if (claimIds.length) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("claims")
      .select("id, policy_service_source, customers(company_name, contact_name, phone), vehicles(vehicle_no, make, model)")
      .in("id", claimIds)
      .returns<ClaimEnrichmentRow[]>();

    for (const row of data ?? []) enrichmentById.set(row.id, row);
  }

  const rows: PartnerClaimPortfolioRow[] = scopedRows.map((row) => {
    const detail = enrichmentById.get(row.claim_id);
    return {
      id: row.claim_id,
      controlNo: row.claim_no,
      insurerClaimNo: row.insurer_claim_no,
      currentStatus: row.current_status,
      source: detail?.policy_service_source === "external" ? "external" : "internal",
      customerName: row.customer_name,
      customerPhone: detail?.customers?.phone ?? null,
      vehicleNo: row.vehicle_no ?? detail?.vehicles?.vehicle_no ?? null,
      vehicleMake: detail?.vehicles?.make ?? null,
      vehicleModel: detail?.vehicles?.model ?? null,
      accidentAt: row.accident_at,
      createdAt: row.created_at,
      insurerName: row.insurer_name,
      policyNo: row.policy_no,
    };
  });

  return (
    <PartnerPortalShell title="Claims">
      <PartnerClaimsPortfolio rows={rows} />
    </PartnerPortalShell>
  );
}
