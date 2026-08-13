import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { loadReportingReadinessExport, type ReadinessDomain } from "@/lib/reports/readiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const profile = await requireCapability("view_reports");
  if (!profile) return new Response("Access denied", { status: 403 });
  const domain = normalizeDomain(request.nextUrl.searchParams.get("domain"));
  const payload = await loadReportingReadinessExport(profile, domain);
  if (payload.truncated) return new Response("More than 10,000 readiness exceptions match this view. Narrow the domain before exporting.", { status: 422 });

  const rows: Array<Array<string | number>> = [
    ["Domain", "Severity", "Record", "Customer", "Issue Count", "Exceptions", "Source Path"],
    ...payload.rows.map((row) => [domainLabel(row.domain), row.severity, row.primary_label, row.secondary_label, row.issue_count, row.issue_labels.join(" | "), row.action_path]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=INSUREIT_Reporting_Readiness_${domain}.csv`,
      "Cache-Control": "no-store",
    },
  });
}

function normalizeDomain(value: string | null): ReadinessDomain { return value === "vehicle" || value === "policy_finance" || value === "claim" || value === "customer" ? value : "all"; }
function domainLabel(value: string) { if(value === "policy_finance") return "Policy & Finance"; if(value === "claim") return "Claims"; if(value === "customer") return "Customer documents"; return "Vehicles"; }
function escapeCsv(value: string | number) { const text = String(value ?? "").replaceAll('"','""'); return `"${text}"`; }
