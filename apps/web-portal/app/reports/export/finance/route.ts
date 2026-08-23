import { NextRequest } from "next/server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { loadFinanceReport, type FinanceQuery } from "@/lib/reports/finance";

export async function GET(request: NextRequest) {
  const profile = await requireCapability("view_reports");
  if(profile.role==="backoffice_executive")return new Response("Finance reporting is not available for this role.",{status:403,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"private, no-store, max-age=0"}});
  if (!canAccessPolicyCommercials(profile)) {
    return new Response("Commercial details restricted", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  const base = toQuery(request.nextUrl.searchParams);
  try {
    const first = await loadFinanceReport(profile, { ...base, page: "1" });
    const total = first.report.register.total_count;
    if (total > 10000) return new Response("This export contains more than 10,000 rows. Narrow the report filters before exporting.", { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

    const rows = [...first.report.register.rows];
    const pages = Math.ceil(total / Math.max(first.report.register.page_size, 1));
    for (let page = 2; page <= pages; page++) {
      const next = await loadFinanceReport(profile, { ...base, page: String(page) });
      rows.push(...next.report.register.rows);
    }

    const headers = ["Business Date", "Policy No", "Policy Type", "Customer", "Customer Code", "Vehicle No", "Insurance Company", "RM", "Intermediary Code", "Gross Premium", "Projected Pay-In", "Gross Partner Payout", "Projected Margin"];
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) {
      lines.push([
        row.business_date,
        row.policy_no,
        row.policy_type,
        row.customer_name,
        row.customer_code,
        row.vehicle_no,
        row.insurer_name,
        row.rm_name ?? "",
        row.intermediary_code ?? "",
        row.gross_premium,
        row.projected_payin,
        row.gross_payout,
        row.projected_payin - row.gross_payout,
      ].map(csvCell).join(","));
    }

    return new Response(`\uFEFF${lines.join("\r\n")}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="insureit-commercials-${indiaDate(new Date())}.csv"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[reports-export] commercial export failed", error instanceof Error ? error.message : "unknown error");
    return new Response("The report export is temporarily unavailable.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}

function toQuery(search: URLSearchParams): FinanceQuery {
  return {
    period: search.get("period") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    insurer: search.get("insurer") ?? undefined,
    rm: search.get("rm") ?? undefined,
    intermediary: search.get("intermediary") ?? undefined,
  };
}
function csvCell(value: unknown) { const text = value == null ? "" : String(value); return `"${text.replace(/"/g, '""')}"`; }
function indiaDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
