import * as XLSX from "xlsx";
import { requireCapability } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";

const headers = [
  "Invoice Date",
  "Policy Start Date",
  "Policy End Date",
  "M LOB",
  "LOB",
  "Chassis No",
  "Registration No",
  "Product Line",
  "Account Name",
  "Contact Name",
  "Account Phone/Fax Number",
  "Contact Phone Number",
  "Current Insurer",
  "Current Policy No",
];

export async function GET() {
  await requireCapability("manage_master_data", "edit");

  const workbook = XLSX.utils.book_new();
  const sampleInvoice = new Date(Date.UTC(2026, 8, 15));
  const renewalSheet = XLSX.utils.aoa_to_sheet([
    headers,
    [
      sampleInvoice,
      { f: "A2" },
      { f: "EDATE(A2,12)" },
      "CV",
      "Commercial Vehicle",
      "MAT12345678901234",
      "MP20AB1234",
      "LPT 1618",
      "Sample Fleet Pvt Ltd",
      "Sample Contact",
      "",
      "9876543210",
      "Sample Insurer",
      "POLICY-SAMPLE-001",
    ],
  ]);
  renewalSheet["!cols"] = headers.map((header) => ({ wch: Math.max(16, Math.min(28, header.length + 3)) }));
  renewalSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  if (renewalSheet.A2) renewalSheet.A2.z = "dd-mm-yyyy";
  if (renewalSheet.B2) renewalSheet.B2.z = "dd-mm-yyyy";
  if (renewalSheet.C2) renewalSheet.C2.z = "dd-mm-yyyy";

  const instructions = XLSX.utils.aoa_to_sheet([
    ["INSUREIT External Renewal Opportunity Import"],
    [],
    ["How to use"],
    ["1", "Select the Partner on the Administration import page; do not add Partner data into the workbook."],
    ["2", "Fill one row per vehicle/external policy opportunity in the External Renewals sheet."],
    ["3", "Invoice Date is authoritative. INSUREIT derives Policy Start Date = Invoice Date and Policy End Date = one calendar year later."],
    ["4", "Policy Start Date and Policy End Date columns are shown for reference. Uploaded values in those columns are not trusted or written."],
    ["5", "Each row needs a valid 10-digit mobile and either Chassis No or Registration No."],
    ["6", "Rows more than 30 days expired, invalid rows and duplicate vehicle/date rows are not published."],
    ["7", "External opportunity imports never create or update verified INSUREIT Customers, Vehicles or Policies."],
    [],
    ["Supported date formats", "DD-MM-YYYY, DD/MM/YYYY or YYYY-MM-DD"],
    ["Maximum workbook size", "5 MB / 5,000 data rows per import"],
  ]);
  instructions["!cols"] = [{ wch: 24 }, { wch: 105 }];

  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  XLSX.utils.book_append_sheet(workbook, renewalSheet, "External Renewals");

  const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(output, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="INSUREIT_External_Renewal_Import_Template.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
