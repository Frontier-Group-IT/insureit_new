import { NextRequest } from "next/server";
import { canViewReportCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { loadManagementPack, managementPackCsvRows } from "@/lib/reports/management-pack";
import { loadManagementPackSnapshot } from "@/lib/reports/management-pack-archive";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const profile = await requireCapability("view_reports");
  const fullCommercialAccess = canViewReportCommercials(profile);
  // ANJU's approved organization-level reports access is not commercial access.
  // Restrict the exception to this active Operations profile and live exports.
  const operationalOnly = !fullCommercialAccess &&
    profile?.id === "82e34a1c-7e0b-4ba8-a058-bb3142734325" &&
    profile.role === "super_admin";
  if (!profile || (!fullCommercialAccess && !operationalOnly) ||
      (operationalOnly && request.nextUrl.searchParams.has("snapshot"))) {
    return new Response("Commercial details restricted", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  const month = request.nextUrl.searchParams.get("month") || undefined;
  const from = request.nextUrl.searchParams.get("from") || undefined;
  const to = request.nextUrl.searchParams.get("to") || undefined;
  const business = request.nextUrl.searchParams.get("business") || undefined;
  const category = request.nextUrl.searchParams.get("category") || undefined;
  const snapshotId = request.nextUrl.searchParams.get("snapshot") || undefined;
  const archived = snapshotId ? await loadManagementPackSnapshot(profile.id, snapshotId) : null;
  if (snapshotId && !archived) return new Response("Snapshot not found", { status: 404 });
  const pack = archived?.pack ?? await loadManagementPack(profile, { month, from, to, business, category }, { operationalOnly });
  const allRows = managementPackCsvRows(pack, archived?.snapshotVersion);
  const operationalSections = new Set(["Business", "Distribution", "Claims", "Renewal snapshot", "Operations snapshot"]);
  const dataRows = operationalOnly ? allRows.filter(([section]) => operationalSections.has(section)) : allRows;
  const rows: Array<Array<string | number>> = [
    ["Month", from && to ? "Custom range" : pack.filters.month],
    ["From", pack.filters.fromDate],
    ["To", pack.filters.toDate],
    ["Scope", pack.scopeMode],
    ["Snapshot", archived ? "Frozen" : "Live"],
    ...(operationalOnly ? [["Access", "Operational only — finance and governance excluded"]] : []),
    ...(archived ? [["Snapshot Version", archived.snapshotVersion] as Array<string | number>, ["Captured", archived.capturedAt] as Array<string | number>] : []),
    [],
    ["Section", "Metric", "Value"],
    ...dataRows,
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const suffix = archived ? "_Frozen" : operationalOnly ? "_Operational" : "";
  const filenameRange = from && to ? `${pack.filters.fromDate}_to_${pack.filters.toDate}` : pack.filters.month;
  const filename = `INSUREIT_Management_Pack_${filenameRange}${suffix}.csv`;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
      "Cache-Control": "no-store",
    },
  });
}

function escapeCsv(value: string | number) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}
