import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { loadPolicyBusinessExport } from "@/lib/reports/policy-business-export";
import type { PolicyBusinessQuery } from "@/lib/reports/policy-business";

export async function GET(request: NextRequest) {
  const profile = await requireCapability("view_reports");
  const query = toQuery(request.nextUrl.searchParams);

  try {
    const { rows, truncated } = await loadPolicyBusinessExport(profile, query);
    if (truncated) {
      return new Response("This export contains more than 10,000 rows. Narrow the report filters before exporting.", {
        status: 422,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const headers = [
      "Business Date", "Policy No", "Customer", "Customer Code", "Vehicle No", "Insurance Company", "Policy Type", "Status",
      "Relationship Manager", "Intermediary Type", "Intermediary Code", "OD Premium", "TP Premium", "CPA", "Net Premium", "Gross Premium", "IDV",
    ];
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) {
      lines.push([
        row.business_date, row.policy_no, row.customer_name, row.customer_code, row.vehicle_no, row.insurer_name, row.policy_type, row.status,
        row.rm_name ?? "", row.intermediary_type ?? "", row.intermediary_code ?? "", row.od_premium, row.tp_premium, row.cpa_amount,
        row.net_premium, row.gross_premium, row.insured_declared_value ?? "",
      ].map(csvCell).join(","));
    }

    return new Response(`\uFEFF${lines.join("\r\n")}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="insureit-policy-business-${indiaDate(new Date())}.csv"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[reports-export] policy business export failed", error instanceof Error ? error.message : "unknown error");
    return new Response("The report export is temporarily unavailable.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

function toQuery(search: URLSearchParams): PolicyBusinessQuery {
  return {
    period: search.get("period") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    insurer: search.get("insurer") ?? undefined,
    rm: search.get("rm") ?? undefined,
    intermediary: search.get("intermediary") ?? undefined,
  };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function indiaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
