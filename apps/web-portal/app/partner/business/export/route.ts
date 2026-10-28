import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

import {
  getPartnerWebBusinessPerformance,
  listPartnerWebPolicies,
  type PartnerPolicyRow,
} from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function numeric(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function validIsoDate(value?: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function policyDate(policy: PartnerPolicyRow) {
  return (policy.issuance_date || policy.start_date || "").slice(0, 10);
}

function normalizedBusinessType(policy: PartnerPolicyRow) {
  const source = String(policy.business_type || policy.business_line || policy.policy_type || "").trim().toLowerCase();
  if (source.includes("non") && source.includes("motor")) return "non motor";
  if (source.includes("motor")) return "motor";
  if (source.includes("life")) return "life";
  if (source.includes("health")) return "health";
  return source || "unclassified";
}

function monthBounds(reference: string, mode: string) {
  const base = new Date(`${reference}T00:00:00Z`);
  if (mode === "last-month") {
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 0));
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  if (mode === "last-6-months") {
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 5, 1));
    return { from: start.toISOString().slice(0, 10), to: reference };
  }
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  return { from: start.toISOString().slice(0, 10), to: reference };
}

async function loadPartnerPolicies() {
  const rows: PartnerPolicyRow[] = [];
  const pageSize = 100; // partner_app_list_policies caps requested pages at 100.
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const batch = await listPartnerWebPolicies({ limit: pageSize, offset, lifecycle: "all" });
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const [performance, policies] = await Promise.all([
    getPartnerWebBusinessPerformance(),
    loadPartnerPolicies(),
  ]);

  const generatedDay = validIsoDate(performance.generated_at?.slice(0, 10))
    ? performance.generated_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const period = params.get("period") || "mtd";
  const custom = period === "custom"
    && validIsoDate(params.get("from"))
    && validIsoDate(params.get("to"))
    && String(params.get("from")) <= String(params.get("to"));
  const bounds = custom
    ? { from: String(params.get("from")), to: String(params.get("to")) }
    : monthBounds(generatedDay, period);

  const business = params.get("business") || "";
  const insurer = params.get("insurer") || "";
  const rm = params.get("rm") || "";
  const intermediary = params.get("intermediary") || "";

  const rows = policies.filter((policy) => {
    const date = policyDate(policy);
    if (!date || date < bounds.from || date > bounds.to) return false;
    if (business && normalizedBusinessType(policy) !== business) return false;
    if (insurer && policy.insurer_name !== insurer) return false;
    if (rm && policy.rm_name !== rm) return false;
    if (intermediary && policy.intermediary_code !== intermediary) return false;
    return true;
  });

  const headers = [
    "Policy No",
    "Policy Code",
    "Customer",
    "Insurer",
    "Business Type",
    "Policy Product",
    "Issue Date",
    "Start Date",
    "End Date",
    "Premium",
    "RM",
    "Intermediary Code",
    "Intermediary Type",
  ];

  // Generate partner-only columns directly. Never add internal pay-in / payout
  // fields to the workbook, including hidden sheets or cells.
  const data = rows.map((row) => [
    row.policy_no, row.policy_code, row.customer_name, row.insurer_name,
    normalizedBusinessType(row), row.policy_product, row.issuance_date,
    row.start_date, row.end_date, numeric(row.premium_amount), row.rm_name,
    row.intermediary_code, row.intermediary_type,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([[], headers, ...data]);
  const lastColumn = XLSX.utils.encode_col(headers.length - 1);
  sheet["!ref"] = `A1:${lastColumn}${Math.max(2, data.length + 2)}`;
  sheet["!autofilter"] = { ref: `A2:${lastColumn}${Math.max(2, data.length + 2)}` };
  sheet["!cols"] = headers.map((header) => ({ wch: Math.min(34, Math.max(15, header.length + 5)) }));
  sheet["!rows"] = [{ hpt: 22 }, { hpt: 38 }];
  sheet["J1"] = { t: "n", f: `SUM(J3:J${Math.max(3, data.length + 2)})`, v: data.reduce((sum, row) => sum + Number(row[9] || 0), 0) };
  for (let index = 0; index < data.length; index++) {
    const cell = sheet[`J${index + 3}`];
    if (cell) cell.z = '₹#,##0.00;[Red]-₹#,##0.00';
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Business MIS");
  book.Props = { Title: "INSUREIT Partner Business MIS", Subject: "Authorized partner policy production", Company: "InsureIt" };
  const file = XLSX.write(book, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="partner-business-${bounds.from}-to-${bounds.to}.xlsx"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
