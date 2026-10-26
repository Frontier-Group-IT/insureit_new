import { NextResponse } from "next/server";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { listPartnerWebPolicies, listPartnerWebClaims } from "@/lib/partner-web";

export const dynamic = "force-dynamic";

// This is intentionally a bounded snapshot, not an unrestricted full export.
// All rows are fetched through the same authenticated Partner Portal RPCs as the registers.
const MAX_ROWS = 200;
function csvCell(value: unknown): string {
  const raw = String(value ?? "").replace(/\r?\n/g, " ");
  // Protect spreadsheet programs from formula injection, including whitespace-prefixed formulas.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function csv(rows: unknown[][]): string {
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export async function GET(request: Request) {
  await requirePartnerReportScope();
  const type = new URL(request.url).searchParams.get("type");
  if (type !== "policies" && type !== "claims") {
    return NextResponse.json({ error: "Unsupported report type" }, { status: 400 });
  }
  let rows: unknown[][];
  if (type === "policies") {
    const policies = await listPartnerWebPolicies({ limit: MAX_ROWS, offset: 0 });
    rows = [
      ["Policy No.", "Customer", "Vehicle", "Insurer", "Product", "Start Date", "End Date", "Status"],
      ...policies.map(p => [p.policy_no, p.customer_name, p.vehicle_no, p.insurer_name, p.policy_product, p.start_date, p.end_date, p.policy_status]),
    ];
  } else {
    const claims = await listPartnerWebClaims({ limit: MAX_ROWS, offset: 0 });
    rows = [
      ["Claim No.", "Customer", "Vehicle", "Policy No.", "Insurer", "Status", "Created At"],
      ...claims.map(c => [c.claim_no, c.customer_name, c.vehicle_no, c.policy_no, c.insurer_name, c.current_status, c.created_at]),
    ];
  }
  return new Response(csv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="partner-${type}-snapshot.csv"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
