import { NextRequest } from "next/server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { loadManagementPack, managementPackCsvRows } from "@/lib/reports/management-pack";
import { loadManagementPackSnapshot } from "@/lib/reports/management-pack-archive";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const profile = await requireCapability("view_reports");
  if (!profile || !canAccessPolicyCommercials(profile)) {
    return new Response("Commercial details restricted", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  const month = request.nextUrl.searchParams.get("month") || undefined;
  const snapshotId = request.nextUrl.searchParams.get("snapshot") || undefined;
  const archived = snapshotId ? await loadManagementPackSnapshot(profile.id, snapshotId) : null;
  if (snapshotId && !archived) return new Response("Snapshot not found", { status: 404 });
  const pack = archived?.pack ?? await loadManagementPack(profile, { month });
  const dataRows = managementPackCsvRows(pack);
  const rows: Array<Array<string | number>> = [
    ["Month", pack.filters.month],
    ["From", pack.filters.fromDate],
    ["To", pack.filters.toDate],
    ["Scope", pack.scopeMode],
    ["Snapshot", archived ? "Frozen" : "Live"],
    ...(archived ? [["Captured", archived.capturedAt] as Array<string | number>] : []),
    [],
    ["Section", "Metric", "Value"],
    ...dataRows,
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const suffix = archived ? "_Frozen" : "";
  const filename = `INSUREIT_Management_Pack_${pack.filters.month}${suffix}.csv`;

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
