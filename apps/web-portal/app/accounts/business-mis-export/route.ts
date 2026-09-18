import * as XLSX from "xlsx";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { resolveAccountsDashboardFilters } from "@/lib/accounts-dashboard";
import {
  BUSINESS_MIS_AMOUNT_COLUMNS,
  BUSINESS_MIS_DATE_COLUMNS,
  BUSINESS_MIS_HEADERS,
  BUSINESS_MIS_PERCENT_COLUMNS,
  BUSINESS_MIS_TOTAL_COLUMNS,
  businessMisPeriodLabel,
  loadBusinessMisRows,
  type BusinessMisRow,
} from "@/lib/accounts-business-mis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const filters = resolveAccountsDashboardFilters({
    period: url.searchParams.get("period") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    insurer: url.searchParams.get("insurer") ?? undefined,
  });

  try {
    const rows = await loadBusinessMisRows(profile, filters);
    return workbookResponse(rows, filters.fromDate, filters.toDate);
  } catch {
    return new Response("Unable to generate Business MIS export.", { status: 500 });
  }
}

function workbookResponse(rows: BusinessMisRow[], fromDate: string, toDate: string) {
  const summary = Array(BUSINESS_MIS_HEADERS.length).fill("");
  summary[0] = businessMisPeriodLabel(fromDate, toDate);
  const worksheet = XLSX.utils.aoa_to_sheet([summary, [...BUSINESS_MIS_HEADERS], ...rows], { cellDates: true });
  const lastRow = Math.max(3, rows.length + 2);

  for (const col of BUSINESS_MIS_TOTAL_COLUMNS) {
    const address = XLSX.utils.encode_cell({ r: 0, c: col });
    worksheet[address] = { t: "n", f: `SUM(${XLSX.utils.encode_cell({ r: 2, c: col })}:${XLSX.utils.encode_cell({ r: lastRow - 1, c: col })})`, v: 0 };
  }

  const grey = "B7B7B7";
  const border = { style: "thin", color: { rgb: "000000" } };
  const headerStyle = { font: { name: "Aptos Display", sz: 11, bold: true }, fill: { patternType: "solid", fgColor: { rgb: grey } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: border, bottom: border, left: border, right: border } };
  const summaryStyle = { font: { name: "Aptos Display", sz: 11, bold: false }, fill: { patternType: "solid", fgColor: { rgb: grey } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: border, bottom: border, left: border, right: border } };
  const bodyStyle = { font: { name: "Aptos", sz: 11 }, alignment: { horizontal: "center", vertical: "center" }, border: { top: border, bottom: border, left: border, right: border } };

  for (let r = 0; r < lastRow; r++) {
    for (let c = 0; c < BUSINESS_MIS_HEADERS.length; c++) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[address] ?? (worksheet[address] = { t: "s", v: "" });
      cell.s = r === 0 ? summaryStyle : r === 1 ? headerStyle : bodyStyle;
      if (r >= 2 && BUSINESS_MIS_AMOUNT_COLUMNS.has(c)) cell.z = "#,##0.00";
      if (r >= 2 && BUSINESS_MIS_PERCENT_COLUMNS.has(c)) cell.z = "0.00";
      if (r >= 2 && BUSINESS_MIS_DATE_COLUMNS.has(c) && cell.t === "d") cell.z = "d/m/yyyy";
      if (r === 0 && BUSINESS_MIS_TOTAL_COLUMNS.includes(c as never)) cell.z = "#,##0.00";
    }
  }

  worksheet["A1"].s = { ...summaryStyle, alignment: { horizontal: "left", vertical: "center" }, font: { name: "Aptos Display", sz: 11, bold: true } };
  worksheet["!cols"] = [
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 28 },
    { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 25 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 17 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 17 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 28 },
  ];
  worksheet["!rows"] = [{ hpt: 20 }, { hpt: 34 }, ...rows.map(() => ({ hpt: 20 }))];
  worksheet["!autofilter"] = { ref: `A2:AF${lastRow}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Business MIS");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true });
  const name = `INSUREIT-Business-MIS-${fromDate}-to-${toDate}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
