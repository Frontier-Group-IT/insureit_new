import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";

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


/** Load non-commercial detail only for policy IDs already authorized by the Partner RPC.
 * Database RPC rechecks each ID using partner_app_policy_in_scope. */
type Related = Record<string, unknown> | Record<string, unknown>[] | null;
type DetailRow = {
  id: string;
  lead_source: string | null;
  insured_declared_value: number | string | null;
  customers: Related;
  vehicles: Related;
  policy_premium_details: Related;
};
const first = (value: Related): Record<string, unknown> | null => Array.isArray(value) ? value[0] ?? null : value;
const safeText = (value: unknown) => value == null ? "" : String(value);
const amountOrBlank = (value: unknown): number | "" => value == null || value === "" ? "" : numeric(value as number | string);
function capacityFor(vehicleClass: string, vehicle: Record<string, unknown> | null) {
  if (!vehicle) return { label: "", value: "" as number | "" };
  const type = vehicleClass.toUpperCase();
  if (type === "GCV") return { label: "GVW", value: amountOrBlank(vehicle.gvw_kg) };
  if (type === "PCV") return { label: "Seating Capacity", value: amountOrBlank(vehicle.seating_capacity) };
  if (type === "PCP" || type === "TWP") return { label: "CC", value: amountOrBlank(vehicle.engine_capacity_cc) };
  if (type === "CPM") return { label: "Equipment Capacity", value: amountOrBlank(vehicle.gvw_kg ?? vehicle.engine_capacity_cc) };
  return { label: "Capacity", value: amountOrBlank(vehicle.gvw_kg ?? vehicle.engine_capacity_cc) };
}
const classNames: Record<string,string> = {
  PCP:"Private Car",TWP:"Two Wheeler",GCV:"Goods Carrying Vehicle",
  PCV:"Passenger Carrying Vehicle",CPM:"Contractor Plant & Machinery",MISD:"Miscellaneous Vehicle",
};
async function loadAuthorizedPolicyDetails(rows: PartnerPolicyRow[]) {
  const ids = [...new Set(rows.map(row=>row.policy_id).filter(Boolean))];
  const details = new Map<string, DetailRow>();
  if (!ids.length) return details;
  const supabase = await createServerSupabaseClient();
  for (let offset=0;offset<ids.length;offset+=100) {
    const batch = ids.slice(offset,offset+100);
    const { data, error } = await supabase.rpc("partner_app_export_policy_details",{
      p_policy_ids: batch,
    });
    if (error) {
      // Server logs retain a bounded diagnostic; never include policy IDs,
      // report data or Supabase internals in the browser-facing error.
      console.error("Partner Business MIS scoped enrichment failed", {
        code: error.code ?? "unknown",
        message: error.message,
        batchCount: batch.length,
      });
      throw new Error("Authorized Partner export details unavailable.");
    }
    const scopedRows = (data ?? []) as unknown as Array<{ policy_id: string; detail: Omit<DetailRow,"id"> }>;
    for(const row of scopedRows) if(batch.includes(row.policy_id))details.set(row.policy_id,{ id:row.policy_id, ...row.detail });
  }
  if(details.size!==ids.length)throw new Error("Partner export detail authorization or completeness check failed.");
  return details;
}

export async function GET(request: NextRequest) {
  await requirePartnerReportScope();
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

  const details = await loadAuthorizedPolicyDetails(rows);
  // Exactly the first 35 Operations Business MIS columns, in their original order.
  // Pay-in, payout, scheme, TDS and retention data are never queried or exported.
  const headers = [
    "Month","Policy Issuance Date","Business Type","RM Name","Intermediary Type","Lead Source","Intermediary Code",
    "Vehicle Class","Registration No.","Insured Name","Phone No.","Class Description","Capacity Type",
    "Make","Model","Fuel Type","Capacity / GVW","Year of Mfg","Chassis No.","Engine No.",
    "Policy Product","IDV / SI","OD Premium","Add-On Premium","Third Party Premium","CPA",
    "Net Premium","GST","Gross Premium","Policy Number","Insurance Company","Valid From","Valid Upto","RTO State","RTO Name",
  ] as const;

  const data = rows.map(row=>{
    const detail=details.get(row.policy_id);
    if(!detail)throw new Error("Missing authorized policy details.");
    const customer=first(detail.customers);
    const vehicle=first(detail.vehicles);
    const premium=first(detail.policy_premium_details);
    const vehicleClass=safeText(vehicle?.vehicle_class_code).toUpperCase();
    const capacity=capacityFor(vehicleClass,vehicle);
    const issueDate=row.issuance_date||"";
    const month=/^\d{4}-\d{2}-\d{2}$/.test(issueDate)
      ? new Intl.DateTimeFormat("en-IN",{month:"long",timeZone:"Asia/Kolkata"}).format(new Date(issueDate+"T00:00:00+05:30")) : "";
    const registration=safeText(vehicle?.vehicle_no||row.vehicle_no);
    return [
      month,issueDate,normalizedBusinessType(row),row.rm_name||"",row.intermediary_type||"",
      detail.lead_source||"",row.intermediary_code||"",
      vehicleClass,/^(?:NEW|PENDING)-/.test(registration)?"NEW":registration,
      safeText(customer?.contact_name)||row.customer_name,safeText(customer?.phone),
      safeText(vehicle?.vehicle_class_description)||classNames[vehicleClass]||"",capacity.label,
      safeText(vehicle?.make),safeText(vehicle?.model),safeText(vehicle?.fuel_type),capacity.value,
      amountOrBlank(vehicle?.year),safeText(vehicle?.chassis_no),safeText(vehicle?.engine_no),
      row.policy_product||"",amountOrBlank(detail.insured_declared_value),
      amountOrBlank(premium?.od_premium),amountOrBlank(premium?.add_on_premium),
      amountOrBlank(premium?.tp_premium),amountOrBlank(premium?.cpa_amount),
      amountOrBlank(premium?.net_premium),amountOrBlank(premium?.gst_amount),
      amountOrBlank(premium?.gross_premium),row.policy_no||"",row.insurer_name||"",
      row.start_date||"",row.end_date||"",safeText(vehicle?.rto_state),safeText(vehicle?.rto_name),
    ];
  });
  const sheet = XLSX.utils.aoa_to_sheet([[], [...headers], ...data]);
  const lastColumn = XLSX.utils.encode_col(headers.length - 1);
  sheet["!ref"] = `A1:${lastColumn}${Math.max(2, data.length + 2)}`;
  sheet["!autofilter"] = { ref: `A2:${lastColumn}${Math.max(2, data.length + 2)}` };
  sheet["!cols"] = headers.map((header) => ({ wch: Math.min(34, Math.max(15, header.length + 5)) }));
  sheet["!rows"] = [{ hpt: 22 }, { hpt: 38 }];
  const premiumHeaders = ["IDV / SI","OD Premium","Add-On Premium","Third Party Premium","CPA","Net Premium","GST","Gross Premium"];
  for(const header of premiumHeaders) {
    const column = XLSX.utils.encode_col(headers.indexOf(header as typeof headers[number]));
    const index = headers.indexOf(header as typeof headers[number]);
    sheet[column+"1"] = { t:"n", f:`SUM(${column}3:${column}${Math.max(3,data.length+2)})`,
      v:data.reduce((total,row)=>total+Number(row[index]||0),0) };
    for(let i=0;i<data.length;i++) {
      const cell=sheet[column+(i+3)];
      if(cell)cell.z='₹#,##0.00;[Red]-₹#,##0.00';
    }
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
