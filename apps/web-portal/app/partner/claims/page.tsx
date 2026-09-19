import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { listPartnerWebClaims, type PartnerClaimRow } from "@/lib/partner-web";
import { PartnerClaimsPortfolio, type PartnerClaimPortfolioRow } from "./claims-portfolio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BATCH_SIZE = 200;
const MAX_ROWS = 5000;

type ExtendedPartnerClaimRow = PartnerClaimRow & {
  customer_phone?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
};

async function loadScopedPartnerClaims() {
  const rows: ExtendedPartnerClaimRow[] = [];
  let offset = 0;
  let total = 1;

  while (offset < total && rows.length < MAX_ROWS) {
    const batch = await listPartnerWebClaims({ limit: BATCH_SIZE, offset, state: "all" }) as ExtendedPartnerClaimRow[];
    if (offset === 0) total = Math.min(batch[0]?.total_count ?? batch.length, MAX_ROWS);
    if (!batch.length) break;
    rows.push(...batch);
    offset += batch.length;
  }

  return rows;
}

export default async function PartnerClaimsPage() {
  const scopedRows = await loadScopedPartnerClaims();

  const rows: PartnerClaimPortfolioRow[] = scopedRows.map((row) => ({
    id: row.claim_id,
    controlNo: row.claim_no,
    insurerClaimNo: row.insurer_claim_no,
    currentStatus: row.current_status,
    // Use the same canonical claim source as Operations. Only an explicit
    // external source is external; null/legacy/internal values stay internal.
    source: row.policy_service_source === "external" ? "external" : "internal",
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? null,
    vehicleNo: row.vehicle_no,
    vehicleMake: row.vehicle_make ?? null,
    vehicleModel: row.vehicle_model ?? null,
    accidentAt: row.accident_at,
    createdAt: row.created_at,
    insurerName: row.insurer_name,
    policyNo: row.policy_no,
  }));

  return (
    <PartnerPortalShell title="Claims">
      <PartnerClaimsPortfolio rows={rows} />
    </PartnerPortalShell>
  );
}
