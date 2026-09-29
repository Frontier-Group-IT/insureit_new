import * as XLSX from "xlsx";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { resolveAccountsDashboardFilters } from "@/lib/accounts-dashboard";
import { loadBusinessMisRecords, type BusinessMisRecord } from "@/lib/accounts-business-mis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOLERANCE = 0.01;

type TemplateType = "payin" | "payout";
type Queue = "all" | "pending" | "partial" | "variance";

export async function GET(request: Request) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const type = normalizeType(url.searchParams.get("type"));
  const queue = normalizeQueue(url.searchParams.get("queue"));
  if (!type) return new Response("Template type must be payin or payout.", { status: 400 });

  const filters = resolveAccountsDashboardFilters({
    period: url.searchParams.get("period") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    insurer: url.searchParams.get("insurer") ?? undefined,
  });

  try {
    const records = await loadBusinessMisRecords(profile, filters);
    const selected = records.filter((record) => queue === "all" || sideStatus(record, type) === queue);
    return workbookResponse(selected, type, queue, filters.fromDate, filters.toDate);
  } catch {
    return new Response("Unable to generate reconciliation transaction template.", { status: 500 });
  }
}

function workbookResponse(records: BusinessMisRecord[], type: TemplateType, queue: Queue, fromDate: string, toDate: string) {
  const payinHeaders = [
    "System Policy ID",
    "Policy Number",
    "Registration No.",
    "Insured Name",
    "Insurance Company",
    "Projected Pay-In",
    "Already Received",
    "Current Difference",
    "New Bill Number",
    "New Bill Amount",
    "New Bill Date",
    "TDS",
    "Remarks",
  ];
  const payoutHeaders = [
    "System Policy ID",
    "System Payout ID",
    "Policy Number",
    "Insured Name",
    "Intermediary Type",
    "Intermediary Code",
    "Projected Payout",
    "Already Paid",
    "Remaining",
    "New Paid Amount",
    "New Paid Date",
    "New UTR / Reference",
    "Remarks",
  ];

  const rows = type === "payin"
    ? records.map((record) => [
        record.policyId,
        text(record.row[12]),
        text(record.row[6]),
        text(record.row[7]),
        text(record.row[13]),
        money(record.row[19]),
        money(record.row[21]),
        Math.max(money(record.row[19]) - money(record.row[21]), 0),
        "",
        "",
        "",
        "",
        "",
      ])
    : records.map((record) => [
        record.policyId,
        record.payoutId,
        text(record.row[12]),
        text(record.row[7]),
        text(record.row[3]),
        text(record.row[5]),
        money(record.row[27]),
        money(record.row[29]),
        Math.max(money(record.row[27]) - money(record.row[29]), 0),
        "",
        "",
        "",
        "",
      ]);

  const headers = type === "payin" ? payinHeaders : payoutHeaders;
  const worksheet = XLSX.utils.aoa_to_sheet([
    [`INSUREIT ${type === "payin" ? "Pay-In" : "Payout"} reconciliation transactions`, `${fromDate} to ${toDate}`, `Queue: ${queue}`],
    headers,
    ...rows,
  ]);

  const hiddenCount = type === "payin" ? 1 : 2;
  worksheet["!cols"] = headers.map((header, index) => ({
    hidden: index < hiddenCount,
    wch: Math.max(14, Math.min(28, header.length + 4)),
  }));
  worksheet["!rows"] = [{ hpt: 22 }, { hpt: 30 }, ...records.map(() => ({ hpt: 20 }))];
  worksheet["!autofilter"] = { ref: `A2:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(2, rows.length + 2)}` };

  const editableStart = type === "payin" ? 8 : 9;
  for (let r = 1; r < rows.length + 2; r++) {
    for (let c = 0; c < headers.length; c++) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[address] ?? (worksheet[address] = { t: "s", v: "" });
      cell.s = {
        font: { name: "Aptos", sz: r === 1 ? 10 : 9, bold: r === 1 },
        alignment: { vertical: "center", wrapText: true },
        fill: r === 1
          ? { patternType: "solid", fgColor: { rgb: "D9E2F3" } }
          : c >= editableStart
            ? { patternType: "solid", fgColor: { rgb: "FFF4CC" } }
            : undefined,
      };
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, type === "payin" ? "Pay-In Transactions" : "Payout Transactions");
  const metadata = XLSX.utils.aoa_to_sheet([
    ["INSUREIT_ACCOUNTS_TRANSACTION_TEMPLATE_V1"],
    ["type", type],
    ["queue", queue],
    ["fromDate", fromDate],
    ["toDate", toDate],
  ]);
  XLSX.utils.book_append_sheet(workbook, metadata, "INSUREIT_META");
  workbook.Workbook = { Sheets: [{ name: type === "payin" ? "Pay-In Transactions" : "Payout Transactions", Hidden: 0 }, { name: "INSUREIT_META", Hidden: 1 }] };

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true });
  const fileName = `INSUREIT-${type === "payin" ? "Pay-In" : "Payout"}-${queue}-${fromDate}-to-${toDate}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function sideStatus(record: BusinessMisRecord, type: TemplateType): Queue | "reconciled" | "not_applicable" {
  const projected = money(record.row[type === "payin" ? 19 : 27]);
  const actual = money(record.row[type === "payin" ? 21 : 29]);
  if (projected <= TOLERANCE && actual <= TOLERANCE) return "not_applicable";
  if (projected <= TOLERANCE && actual > TOLERANCE) return "variance";
  if (actual <= TOLERANCE) return "pending";
  if (Math.abs(actual - projected) <= TOLERANCE) return "reconciled";
  if (actual < projected) return "partial";
  return "variance";
}

function normalizeType(value: string | null): TemplateType | null {
  return value === "payin" || value === "payout" ? value : null;
}

function normalizeQueue(value: string | null): Queue {
  return value === "pending" || value === "partial" || value === "variance" ? value : "all";
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}
