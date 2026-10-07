import { NextRequest, NextResponse } from "next/server";

import {
  getPartnerWebBusinessPerformance,
  listPartnerWebPolicies,
  type PartnerPolicyRow,
} from "@/lib/partner-web";

export const dynamic = "force-dynamic";

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
  const pageSize = 200;
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const batch = await listPartnerWebPolicies({ limit: pageSize, offset, lifecycle: "all" });
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
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

  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => [
      row.policy_no,
      row.policy_code,
      row.customer_name,
      row.insurer_name,
      normalizedBusinessType(row),
      row.policy_product,
      row.issuance_date,
      row.start_date,
      row.end_date,
      numeric(row.premium_amount),
      row.rm_name,
      row.intermediary_code,
      row.intermediary_type,
    ].map(csvCell).join(",")),
  ];

  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="partner-business-${bounds.from}-to-${bounds.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
