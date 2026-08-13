import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { loadManagementPack, managementPackCsvRows } from "@/lib/reports/management-pack";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const profile = await requireCapability("view_reports");
  if (!profile) return new Response("Access denied", { status: 403 });

  const month = request.nextUrl.searchParams.get("month") || undefined;
  const pack = await loadManagementPack(profile, { month });
  const dataRows = managementPackCsvRows(pack);
  const rows: Array<Array<string | number>> = [
    ["Month", pack.filters.month],
    ["From", pack.filters.fromDate],
    ["To", pack.filters.toDate],
    ["Scope", pack.scopeMode],
    [],
    ["Section", "Metric", "Value"],
    ...dataRows,
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const filename = `INSUREIT_Management_Pack_${pack.filters.month}.csv`;

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
