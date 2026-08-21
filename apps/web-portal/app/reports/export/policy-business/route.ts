import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireCapability } from "@/lib/master-data-server";
import { loadPolicyBusinessMisExport, type PolicyBusinessMisRow } from "@/lib/reports/policy-business-mis-export";
import type { PolicyBusinessQuery } from "@/lib/reports/policy-business";

export const runtime = "nodejs";

const HEADERS = [
  "Month", "Policy Issuance Date", "RM Name", "Intermediary Type", "Lead Source", "Intermediary Code",
  "Vehicle Class", "Registration No.", "Insured Name", "Phone No.", "Class Description", "Capacity Type",
  "Make", "Model", "Fuel Type", "Capacity / GVW", "Year of Mfg", "Chassis No.", "Engine No.",
  "Policy Product", "IDV / SI", "OD Premium", "Third Party Premium", "CPA", "Net Premium", "GST", "Gross Premium",
  "Policy Number", "Insurance Company", "Valid From", "Valid Upto", "RTO State", "RTO Name", "Pay-in Basis",
  "Pay-in % OD", "OD Pay-in Amount", "Pay-in % TP", "TP Pay-in Amount", "Total Pay-in", "TDS",
  "Payout OD %", "Payout TP %", "Gross Payout", "Retention",
] as const;

const MONEY_COLUMNS = new Set(["U", "V", "W", "X", "Y", "Z", "AA", "AJ", "AL", "AM", "AN", "AQ", "AR"]);
const PERCENT_COLUMNS = new Set(["AI", "AK", "AO", "AP"]);
const NUMERIC_COLUMNS = new Set(["P", "Q"]);
const SUMMARY_COLUMNS = ["V", "W", "X", "Y", "Z", "AA", "AJ", "AL", "AM", "AN", "AQ", "AR"] as const;

export async function GET(request: NextRequest) {
  const profile = await requireCapability("view_reports");
  const query = toQuery(request.nextUrl.searchParams);

  try {
    const { rows, truncated } = await loadPolicyBusinessMisExport(profile, query);
    if (truncated) {
      return new Response("This export contains more than 10,000 rows. Narrow the report filters before exporting.", {
        status: 422,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const workbook = buildWorkbook(rows);
    return new Response(workbook, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="insureit-detailed-business-mis-${indiaDate(new Date())}.xlsx"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[reports-export] detailed policy business MIS failed", error instanceof Error ? error.message : "unknown error");
    return new Response("The detailed business MIS export is temporarily unavailable.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

function buildWorkbook(rows: PolicyBusinessMisRow[]) {
  const data = rows.map(toSpreadsheetRow);
  const sheet = XLSX.utils.aoa_to_sheet([new Array(HEADERS.length).fill(null), [...HEADERS], ...data]);
  const lastRow = Math.max(rows.length + 2, 3);
  const totals = totalsFor(rows);

  for (const column of SUMMARY_COLUMNS) {
    const property = summaryProperty(column);
    sheet[`${column}1`] = { t: "n", f: `SUM(${column}3:${column}${lastRow})`, v: totals[property] };
  }
  sheet["!ref"] = `A1:AR${Math.max(rows.length + 2, 2)}`;
  sheet["!autofilter"] = { ref: `A2:AR${Math.max(rows.length + 2, 2)}` };
  sheet["!cols"] = columnWidths();
  sheet["!rows"] = [{ hpt: 22 }, { hpt: 38 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Business MIS");
  workbook.Props = { Title: "InsureIt Detailed Business MIS", Subject: "Policy production business register", Company: "InsureIt" };

  const raw = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
  return applyWorkbookStyles(new Uint8Array(raw));
}

function toSpreadsheetRow(row: PolicyBusinessMisRow) {
  return [
    monthName(row.issuanceDate), row.issuanceDate, row.rmName, row.intermediaryType, row.leadSource, row.intermediaryCode,
    row.vehicleClass, row.registrationNo, row.insuredName, row.phoneNo, row.classDescription, row.capacityType,
    row.make, row.model, row.fuelType, row.capacity, row.manufacturingYear, row.chassisNo, row.engineNo,
    row.policyProduct, row.idv, row.odPremium, row.tpPremium, row.cpa, row.netPremium, row.gst, row.grossPremium,
    row.policyNumber, row.insuranceCompany, row.validFrom, row.validUpto, row.rtoState, row.rtoName, row.payinBasis,
    row.payinOdPercent / 100, row.payinOdAmount, row.payinTpPercent / 100, row.payinTpAmount, row.totalPayin, row.tds,
    row.payoutOdPercent / 100, row.payoutTpPercent / 100, row.grossPayout, row.retention,
  ];
}

function totalsFor(rows: PolicyBusinessMisRow[]) {
  return rows.reduce((total, row) => ({
    odPremium: total.odPremium + row.odPremium,
    tpPremium: total.tpPremium + row.tpPremium,
    cpa: total.cpa + row.cpa,
    netPremium: total.netPremium + row.netPremium,
    gst: total.gst + row.gst,
    grossPremium: total.grossPremium + row.grossPremium,
    payinOdAmount: total.payinOdAmount + row.payinOdAmount,
    payinTpAmount: total.payinTpAmount + row.payinTpAmount,
    totalPayin: total.totalPayin + row.totalPayin,
    tds: total.tds + row.tds,
    grossPayout: total.grossPayout + row.grossPayout,
    retention: total.retention + row.retention,
  }), { odPremium: 0, tpPremium: 0, cpa: 0, netPremium: 0, gst: 0, grossPremium: 0, payinOdAmount: 0, payinTpAmount: 0, totalPayin: 0, tds: 0, grossPayout: 0, retention: 0 });
}

function summaryProperty(column: typeof SUMMARY_COLUMNS[number]): keyof ReturnType<typeof totalsFor> {
  return ({ V: "odPremium", W: "tpPremium", X: "cpa", Y: "netPremium", Z: "gst", AA: "grossPremium", AJ: "payinOdAmount", AL: "payinTpAmount", AM: "totalPayin", AN: "tds", AQ: "grossPayout", AR: "retention" } as const)[column];
}

function columnWidths() {
  const widths = [10, 14, 20, 17, 24, 18, 13, 18, 28, 15, 24, 18, 18, 30, 14, 16, 12, 24, 22, 18, 14, 14, 16, 12, 14, 12, 14, 25, 30, 14, 14, 18, 24, 14, 13, 16, 13, 16, 15, 13, 13, 13, 16, 16];
  return widths.map((wch) => ({ wch }));
}

function applyWorkbookStyles(buffer: Uint8Array) {
  const files = unzipSync(buffer);
  files["xl/styles.xml"] = strToU8(stylesXml());
  const sheetPath = "xl/worksheets/sheet1.xml";
  const xml = strFromU8(files[sheetPath]);
  files[sheetPath] = strToU8(styleSheetXml(xml));
  return zipSync(files, { level: 6 });
}

function styleSheetXml(xml: string) {
  let styled = xml.replace(/<c r="([A-Z]+)(\d+)"([^>]*)>/g, (full, column: string, rowText: string, attrs: string) => {
    const row = Number(rowText);
    let style = 3;
    if (row === 1) style = 1;
    else if (row === 2) style = 2;
    else if (MONEY_COLUMNS.has(column)) style = 5;
    else if (PERCENT_COLUMNS.has(column)) style = 6;
    else if (NUMERIC_COLUMNS.has(column)) style = 7;
    const cleanAttrs = attrs.replace(/\s+s="\d+"/g, "");
    return `<c r="${column}${rowText}" s="${style}"${cleanAttrs}>`;
  });
  styled = styled.replace(
    /<sheetViews><sheetView workbookViewId="0"\s*\/><\/sheetViews>/,
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A3" sqref="A3"/></sheetView></sheetViews>',
  );
  return styled;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="₹#,##0.00;[Red]-₹#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0.00%"/>
  </numFmts>
  <fonts count="3">
    <font><sz val="10"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="9"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><color rgb="FF17365D"/><sz val="10"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD7DFE8"/></left><right style="thin"><color rgb="FFD7DFE8"/></right><top style="thin"><color rgb="FFD7DFE8"/></top><bottom style="thin"><color rgb="FFD7DFE8"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
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

function monthName(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`));
}

function indiaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
