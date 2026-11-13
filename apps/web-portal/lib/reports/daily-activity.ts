import "server-only";

import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { resolveDailyReportActorIds } from "@/lib/reports/daily-activity-actor-scope";
import { dailyPageWindow, dailyHasMore, DAILY_PAGE_SIZE } from "@/lib/reports/daily-activity-pagination";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type DailyActivityGroup = "all" | "policy" | "intake" | "case" | "customer" | "vehicle" | "claim" | "other";
export type DailyActivityScope = "self" | "all";
export type DailyActivityQuery = { date?: string; scope?: string; employee?: string; type?: string; page?: string };
export type DailyActivityRow = {
  id: string; actorId: string; employeeName: string; employeeCode: string;
  type: string; group: Exclude<DailyActivityGroup, "all">;
  reference: string; occurredAt: string; status: string;
  source: "Audit" | "Record history";
};
type Viewer = { id: string; role: string | null };
type Profile = { id: string; full_name: string | null; employee_code: string | null };
type Audit = { id: string; actor_id: string | null; action: string; table_name: string | null; record_id: string | null; created_at: string };
type Policy = { id: string; created_by: string | null; policy_no: string | null; created_at: string };
type Intake = { id: string; submitted_by_profile_id: string | null; intake_number: string; created_at: string; finalized_at: string | null; finalized_by_profile_id: string | null };
type Case = { id: string; created_by: string | null; case_number: string; created_at: string; converted_at: string | null; converted_by: string | null };
type RawActivity = Omit<DailyActivityRow, "employeeName" | "employeeCode"> & { table?: string; recordId?: string };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DAILY_ACTIVITY_GROUPS: { value: DailyActivityGroup; label: string }[] = [
  {value:"all",label:"All activities"}, {value:"policy",label:"Policy / Onboarding"},
  {value:"intake",label:"Policy Intake"}, {value:"case",label:"Case Register"},
  {value:"customer",label:"Customers"}, {value:"vehicle",label:"Vehicles"},
  {value:"claim",label:"Claims"}, {value:"other",label:"Other activities"},
];

function indiaToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(new Date());
  const get = (kind: string) => parts.find(p => p.type === kind)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function safeDate(value: string | undefined): string {
  if (!value || !DATE_RE.test(value)) return indiaToday();
  const date = new Date(`${value}T00:00:00+05:30`);
  if (!Number.isFinite(date.getTime())) return indiaToday();
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(date);
  const get = (kind: string) => day.find(p => p.type === kind)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}` === value ? value : indiaToday();
}

function groupForAudit(table: string | null): Exclude<DailyActivityGroup, "all"> {
  const name = (table ?? "").toLowerCase();
  if (name === "policies" || name.startsWith("policy_") && name !== "policy_intake_requests") return "policy";
  if (name === "policy_intake_requests") return "intake";
  if (name === "life_health_cases") return "case";
  if (name === "customers") return "customer";
  if (name === "vehicles") return "vehicle";
  if (name.startsWith("claim")) return "claim";
  return "other";
}

function actionLabel(action: string): string {
  const names: Record<string, string> = {
    policy_created: "Policy Add", policy_edited: "Policy Edit",
    policy_intake_review_started: "Policy Intake Review Started",
    policy_intake_attention_requested: "Policy Intake Attention Requested",
    policy_intake_rejected: "Policy Intake Rejected",
    policy_intake_response_uploaded: "Policy Intake Response Uploaded",
    life_health_case_edited: "Policy Edit Case Register",
    life_health_case_remark_added: "Case Remark Added",
    life_health_case_rejected: "Case Rejected",
    customer_created: "Customer Add", customer_edited: "Customer Edit",
    vehicle_created: "Vehicle Add", vehicle_edited: "Vehicle Edit",
    life_health_case_created: "Case Created", life_health_case_closed: "Case Closed",
  };
  return names[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function outcome(action: string): string {
  if (/reject/i.test(action)) return "Rejected";
  if (/review_started/i.test(action)) return "In review";
  if (/attention_requested/i.test(action)) return "Needs attention";
  if (/delet|remov|archiv/i.test(action)) return "Deleted";
  if (/creat|add|upload|invit/i.test(action)) return "Created";
  if (/approv|verif/i.test(action)) return "Approved";
  if (/edit|updat|chang|replac|correct/i.test(action)) return "Updated";
  if (/submit/i.test(action)) return "Submitted";
  if (/clos|complet|finaliz/i.test(action)) return "Completed";
  return "Recorded";
}

export async function loadDailyActivityReport(viewer: Viewer, query: DailyActivityQuery) {
  const scope: DailyActivityScope = query.scope === "all" ? "all" : "self";
  const type = DAILY_ACTIVITY_GROUPS.some(item => item.value === query.type)
    ? query.type as DailyActivityGroup : "all";
  const date = safeDate(query.date);
  const { page, start, sourceLimit } = dailyPageWindow(query.page);
  const employee = scope === "all" ? (query.employee ?? "").trim().slice(0, 80) : "";
  const from = new Date(`${date}T00:00:00+05:30`);
  const to = new Date(from.getTime() + 86_400_000);
  const startIso = from.toISOString(), endIso = to.toISOString();
  const admin = createSupabaseAdminClient();
  const access = await getEmployeeAccessScope(viewer.id, viewer.role, "view_reports");
  const allowedIds = resolveDailyReportActorIds(viewer.id, scope, access);
  let profileQuery = admin.from("profiles")
    .select("id,full_name,employee_code").order("full_name", { ascending: true }).limit(1000);
  if (allowedIds !== null) profileQuery = profileQuery.in("id", allowedIds);
  const { data: profiles, error: profileError } = await profileQuery.returns<Profile[]>();
  if (profileError) throw new Error(`Could not load authorized employee directory: ${profileError.message}`);
  const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]));
  // Some older users lack an employee link: Self still needs the authenticated profile.
  if (!profileMap.has(viewer.id)) {
    const { data: self, error } = await admin.from("profiles").select("id,full_name,employee_code")
      .eq("id", viewer.id).maybeSingle<Profile>();
    if (error) throw new Error("Could not resolve authenticated employee identity");
    if (self) profileMap.set(self.id, self);
  }
  const normalizedEmployee = employee.toLocaleLowerCase("en-IN");
  const actorIds = Array.from(profileMap.values())
    .filter(p => !normalizedEmployee ||
      (p.full_name ?? "").toLocaleLowerCase("en-IN").includes(normalizedEmployee) ||
      (p.employee_code ?? "").toLocaleLowerCase("en-IN").includes(normalizedEmployee))
    .map(p => p.id);
  const filters = { scope, type, date, employee, page };
  if (!actorIds.length) return { rows: [] as DailyActivityRow[], hasNext: false, truncated: false, filters, coverageLimited: true, pageSize: DAILY_PAGE_SIZE };
  // Bounded queries; no unfiltered audit/history table scans or client-side permission filtering.
  const limit = sourceLimit;
  const auditEnabled = true;
  const policyEnabled = type === "all" || type === "policy";
  const intakeEnabled = type === "all" || type === "intake";
  const caseEnabled = type === "all" || type === "case";
  const [audits, policies, intakes, cases, finalizedIntakes, convertedCases] = await Promise.all([
    (async (): Promise<Audit[]> => {
      if (!auditEnabled) return [];
      let q = admin.from("audit_logs").select("id,actor_id,action,table_name,record_id,created_at")
        .in("actor_id", actorIds).gte("created_at", startIso).lt("created_at", endIso)
        .order("created_at", {ascending:false}).limit(limit);
      if (type !== "all") {
        if (type === "policy") q = q.or("table_name.eq.policies,table_name.like.policy_%");
        else if (type === "intake") q = q.eq("table_name", "policy_intake_requests");
        else if (type === "case") q = q.eq("table_name", "life_health_cases");
        else if (type === "customer") q = q.eq("table_name", "customers");
        else if (type === "vehicle") q = q.eq("table_name", "vehicles");
        else if (type === "claim") q = q.ilike("table_name", "claim%");
        else q = q.not("table_name", "in", "(policies,policy_intake_requests,life_health_cases,customers,vehicles)").not("table_name", "like", "policy_%").not("table_name", "ilike", "claim%");
      }
      const {data,error} = await q.returns<Audit[]>();
      if(error) throw new Error(`Daily audit query failed: ${error.message}`);
      return data ?? [];
    })(),
    (async (): Promise<Policy[]> => {
      if (!policyEnabled) return [];
      const {data,error} = await admin.from("policies").select("id,created_by,policy_no,created_at")
        .in("created_by",actorIds).gte("created_at",startIso).lt("created_at",endIso)
        .order("created_at",{ascending:false}).limit(limit).returns<Policy[]>();
      if(error) throw new Error(`Daily policy history query failed: ${error.message}`);
      return data ?? [];
    })(),
    (async (): Promise<Intake[]> => {
      if (!intakeEnabled) return [];
      const {data,error} = await admin.from("policy_intake_requests")
        .select("id,submitted_by_profile_id,intake_number,created_at,finalized_at,finalized_by_profile_id")
        .in("submitted_by_profile_id",actorIds).gte("created_at",startIso).lt("created_at",endIso)
        .order("created_at",{ascending:false}).limit(limit).returns<Intake[]>();
      if(error) throw new Error(`Daily intake history query failed: ${error.message}`);
      return data ?? [];
    })(),
    (async (): Promise<Case[]> => {
      if (!caseEnabled) return [];
      const {data,error} = await admin.from("life_health_cases")
        .select("id,created_by,case_number,created_at,converted_at,converted_by")
        .in("created_by",actorIds).gte("created_at",startIso).lt("created_at",endIso)
        .order("created_at",{ascending:false}).limit(limit).returns<Case[]>();
      if(error) throw new Error(`Daily case history query failed: ${error.message}`);
      return data ?? [];
    })(),
    (async (): Promise<Intake[]> => {
      if (!intakeEnabled) return [];
      const {data,error} = await admin.from("policy_intake_requests")
        .select("id,submitted_by_profile_id,intake_number,created_at,finalized_at,finalized_by_profile_id")
        .in("finalized_by_profile_id",actorIds).gte("finalized_at",startIso).lt("finalized_at",endIso)
        .order("finalized_at",{ascending:false}).limit(limit).returns<Intake[]>();
      if(error) throw new Error(`Daily intake finalizations query failed: ${error.message}`);
      return data ?? [];
    })(),
    (async (): Promise<Case[]> => {
      if (!caseEnabled) return [];
      const {data,error} = await admin.from("life_health_cases")
        .select("id,created_by,case_number,created_at,converted_at,converted_by")
        .in("converted_by",actorIds).gte("converted_at",startIso).lt("converted_at",endIso)
        .order("converted_at",{ascending:false}).limit(limit).returns<Case[]>();
      if(error) throw new Error(`Daily case conversions query failed: ${error.message}`);
      return data ?? [];
    })(),
  ]);
  const events: RawActivity[] = [];
  for (const a of audits) {
    if (!a.actor_id) continue;
    // Prevent double counting against the immutable create streams below.
    if (a.action === "policy_created" || a.action === "life_health_case_created" ||
      a.action === "life_health_case_closed") continue;
    const group = groupForAudit(a.table_name);
    if (type !== "all" && group !== type) continue;
    events.push({id:`audit:${a.id}`,actorId:a.actor_id,type:actionLabel(a.action),group,
      reference:a.record_id ?? "—",occurredAt:a.created_at,status:outcome(a.action),
      source:"Audit",table:a.table_name ?? undefined,recordId:a.record_id ?? undefined});
  }
  for (const p of policies) if (p.created_by) events.push({
    id:`policy:${p.id}`,actorId:p.created_by,type:"Policy Add",group:"policy",
    reference:p.policy_no || p.id,occurredAt:p.created_at,status:"Created",source:"Record history",
  });
  for (const i of intakes) if (i.submitted_by_profile_id) events.push({
    id:`intake:${i.id}`,actorId:i.submitted_by_profile_id,type:"Policy Intake Submitted",group:"intake",
    reference:i.intake_number,occurredAt:i.created_at,status:"Submitted",source:"Record history",
  });
  for (const c of cases) if (c.created_by) events.push({
    id:`case:${c.id}`,actorId:c.created_by,type:"Case Created",group:"case",
    reference:c.case_number,occurredAt:c.created_at,status:"Created",source:"Record history",
  });
  for (const i of finalizedIntakes) if (i.finalized_by_profile_id && i.finalized_at) events.push({
    id:`intake-finalized:${i.id}`,actorId:i.finalized_by_profile_id,
    type:"Policy Intake Finalized",group:"intake",reference:i.intake_number,
    occurredAt:i.finalized_at,status:"Completed",source:"Record history",
  });
  for (const c of convertedCases) if (c.converted_by && c.converted_at) events.push({
    id:`case-converted:${c.id}`,actorId:c.converted_by,
    type:"Case Converted to Policy",group:"case",reference:c.case_number,
    occurredAt:c.converted_at,status:"Completed",source:"Record history",
  });
  events.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
  const visible = events.slice(start,start + DAILY_PAGE_SIZE);
  // Resolve human-facing reference numbers only for the visible page, not entire tables.
  const refs = new Map<string,string>();
  const referenceSources: {table:string; column:string}[] = [
    {table:"policies",column:"policy_no"},{table:"customers",column:"customer_code"},
    {table:"vehicles",column:"vehicle_no"},{table:"policy_intake_requests",column:"intake_number"},
    {table:"life_health_cases",column:"case_number"},
  ];
  await Promise.all(referenceSources.map(async ({table,column})=>{
    const ids = [...new Set(visible.filter(e=>e.table === table && UUID_RE.test(e.recordId ?? ""))
      .map(e=>e.recordId as string))];
    if (!ids.length) return;
    const {data,error} = await admin.from(table).select(`id,${column}`).in("id",ids);
    if(error) throw new Error(`Could not resolve activity reference: ${error.message}`);
    for(const row of (data ?? []) as unknown as Record<string,unknown>[]) {
      const value=row[column];
      if(typeof row.id==="string" && typeof value==="string" && value.trim()) refs.set(`${table}:${row.id}`,value);
    }
  }));
  const rows: DailyActivityRow[] = visible.map(e=>{
    const p=profileMap.get(e.actorId);
    return {id:e.id,actorId:e.actorId,employeeName:p?.full_name || "Unknown employee",
      employeeCode:p?.employee_code || "",type:e.type,group:e.group,
      reference:refs.get(`${e.table}:${e.recordId}`) || e.reference,
      occurredAt:e.occurredAt,status:e.status,source:e.source};
  });
  return {rows,...dailyHasMore(events.length, start, page),
    filters,coverageLimited:true,pageSize:DAILY_PAGE_SIZE};
}
