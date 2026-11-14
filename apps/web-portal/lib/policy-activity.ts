import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const POLICY_ACTIVITY_ACTIONS = {
  POLICY_CREATED: "policy_created",
  PREVIOUS_MONTH_POLICY_UPLOADED: "previous_month_policy_uploaded",
  POLICY_EDITED: "policy_edited",
  POLICY_DOC_UPLOADED: "policy_doc_uploaded",
  POLICY_DOC_REPLACED: "policy_doc_replaced",
  POLICY_DOC_REMOVED: "policy_doc_removed",
  PAYIN_BILLING_ADDED: "payin_billing_added",
  PAYIN_BILLING_UPDATED: "payin_billing_updated",
  POLICY_SUPERSEDED: "policy_superseded",
  POLICY_REPLACEMENT_CREATED: "policy_replacement_created",
  POLICY_DATA_CORRECTED: "policy_data_corrected",
  VEHICLE_DATA_CORRECTED: "vehicle_data_corrected",
  LIFE_HEALTH_CASE_CREATED: "life_health_case_created",
  LIFE_HEALTH_CASE_CLOSED: "life_health_case_closed",
} as const;

export type PolicyActivityAction = (typeof POLICY_ACTIVITY_ACTIONS)[keyof typeof POLICY_ACTIVITY_ACTIONS];
type AuditedPolicyActivityAction = Exclude<PolicyActivityAction, "life_health_case_created" | "life_health_case_closed">;

const ACTION_LABELS: Record<PolicyActivityAction, string> = {
  policy_created: "Policy Created",
  previous_month_policy_uploaded: "Previous-month policy uploaded",
  policy_edited: "Policy Edited",
  policy_doc_uploaded: "Policy Doc. Uploaded",
  policy_doc_replaced: "Policy Doc. Replaced",
  policy_doc_removed: "Policy Doc. Removed",
  payin_billing_added: "Pay-in Billing Added",
  payin_billing_updated: "Pay-in Billing Updated",
  policy_superseded: "Policy Superseded",
  policy_replacement_created: "Replacement Policy Created",
  policy_data_corrected: "Policy Data Corrected",
  vehicle_data_corrected: "Vehicle Data Corrected",
  life_health_case_created: "Case Created",
  life_health_case_closed: "Policy Created & Case Closed",
};

const TRACKED_ACTIONS: AuditedPolicyActivityAction[] = [
  POLICY_ACTIVITY_ACTIONS.POLICY_CREATED,
  POLICY_ACTIVITY_ACTIONS.PREVIOUS_MONTH_POLICY_UPLOADED,
  POLICY_ACTIVITY_ACTIONS.POLICY_EDITED,
  POLICY_ACTIVITY_ACTIONS.POLICY_DOC_UPLOADED,
  POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REPLACED,
  POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REMOVED,
  POLICY_ACTIVITY_ACTIONS.PAYIN_BILLING_ADDED,
  POLICY_ACTIVITY_ACTIONS.PAYIN_BILLING_UPDATED,
  POLICY_ACTIVITY_ACTIONS.POLICY_SUPERSEDED,
  POLICY_ACTIVITY_ACTIONS.POLICY_REPLACEMENT_CREATED,
  POLICY_ACTIVITY_ACTIONS.POLICY_DATA_CORRECTED,
  POLICY_ACTIVITY_ACTIONS.VEHICLE_DATA_CORRECTED,
];
const ACTIVITY_TABLE_NAME = "policies";
const RECONCILIATION_ACTOR_NAME = "System Reconciliation";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type AuditRow = { id: string; actor_id: string | null; action: string; created_at: string; new_data?: { approved_by?: string | null; issuance_date?: string; changed_fields?: unknown } | null };
type DocumentRow = { uploaded_by: string | null; created_at: string; updated_at: string };
type ProfileRow = { id: string; full_name: string | null };
type LifeHealthCaseActivityRow = {
  id: string;
  created_at: string | null;
  created_by: string | null;
  converted_at: string | null;
  converted_by: string | null;
};

type ActivityCandidate = {
  id: string;
  action: PolicyActivityAction;
  actorId: string | null;
  actorName?: string | null;
  approvedBy?: string | null;
  policyDate?: string | null;
  changedFields?: string[] | null;
  at: string;
};

export type PolicyActivityDisplay = {
  id: string;
  action: string;
  actorName: string;
  meta?: string;
  changes?: string[] | null;
  at: string;
};

function asTrackedAction(value: string): AuditedPolicyActivityAction | null {
  return TRACKED_ACTIONS.includes(value as AuditedPolicyActivityAction) ? value as AuditedPolicyActivityAction : null;
}

function reconciliationActorName(action: PolicyActivityAction, actorId: string | null) {
  if (actorId) return null;
  if (
    action === POLICY_ACTIVITY_ACTIONS.POLICY_DATA_CORRECTED
    || action === POLICY_ACTIVITY_ACTIONS.VEHICLE_DATA_CORRECTED
  ) return RECONCILIATION_ACTOR_NAME;
  return null;
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function materiallyLater(updatedAt: string | null | undefined, createdAt: string | null | undefined) {
  return timestamp(updatedAt) - timestamp(createdAt) > 1000;
}

const POLICY_EDIT_FIELDS = {
  policy: {
    policy_no: "Policy number", status: "Policy status", business_line: "Business line",
    policy_type: "Policy category", policy_product: "Policy product", insurance_company_id: "Insurer",
    issuance_date: "Issuance date", start_date: "Policy start date", end_date: "Policy expiry date",
    policy_term: "Policy term", premium_amount: "Premium", insured_declared_value: "Sum insured / IDV",
    intermediary_type: "Intermediary type", intermediary_code: "Intermediary code",
    lead_source: "Lead source", rm_name: "Relationship manager", remarks: "Remarks",
  },
  premium: { od_premium: "OD premium", tp_premium: "TP premium", add_on_premium: "Add-on premium",
    cpa_amount: "CPA amount", cpa_opted: "CPA opted", net_premium: "Net premium", gst_amount: "GST", gross_premium: "Gross premium" },
  payin: { commercial_basis: "Pay-in basis", projected_commission_percent: "Pay-in rate",
    projected_od_percent: "Pay-in OD rate", projected_tp_percent: "Pay-in TP rate",
    projected_commission_amount: "Projected insurer pay-in", insurer_scheme_amount: "Insurer incentive",
    total_projected_payin: "Total projected pay-in", commercial_status: "Pay-in entry status" },
  payout: { payout_basis: "Partner payout basis", partner_payout_percent: "Partner payout rate",
    od_payout_percent: "Partner payout OD rate", tp_payout_percent: "Partner payout TP rate",
    partner_payout_amount: "Partner payout amount", commercial_status: "Payout entry status" },
  case: { product_name: "Life/Health product", proposal_number: "Proposal number",
    premium_paying_term: "Premium-paying term", policy_duration: "Policy duration",
    payment_frequency: "Payment frequency", payment_mode: "Payment mode",
    premium_amount: "Case premium", remarks: "Case remarks" },
  nonMotor: { category: "Non-Motor category", risk_title: "Risk description",
    risk_location: "Risk location", occupancy_type: "Occupancy", transit_from: "Transit origin",
    transit_to: "Transit destination", transit_mode: "Transit mode", nature_of_business: "Nature of business",
    liability_type: "Liability cover", employee_count: "Employee count",
    annual_wages: "Annual wages", annual_turnover: "Annual turnover",
    sum_insured: "Non-Motor sum insured", deductible: "Deductible",
    proposal_number: "Non-Motor proposal number", previous_insurer: "Previous insurer",
    previous_policy_number: "Previous policy number", previous_claims: "Prior claims",
    add_ons: "Add-ons", warranties: "Warranties", special_conditions: "Special conditions",
    endorsements: "Endorsements" },
  issuedSchedule: { policy_start_date: "Issued policy start date",
    policy_end_maturity_date: "Policy maturity date", ppt_end_date: "Premium-paying term end",
    next_installment_date: "Next instalment date" },
} as const;

export type PolicyEditSnapshot = Record<string, string | null>;

// Read-only, allowlisted field snapshot for a confirmed policy. Never store
// arbitrary JSON, customer PII, financial values or raw remarks in audit logs.
export async function capturePolicyEditSnapshot(admin: AdminClient, policyId: string): Promise<PolicyEditSnapshot | null> {
  const [policy, premium, payin, payout, lifeCase, nonMotor, issuedDetails] = await Promise.all([
    admin.from("policies")
      .select(Object.keys(POLICY_EDIT_FIELDS.policy).join(",")).eq("id",policyId).maybeSingle(),
    admin.from("policy_premium_details")
      .select(Object.keys(POLICY_EDIT_FIELDS.premium).join(",")).eq("policy_id",policyId).maybeSingle(),
    admin.from("policy_payin_details")
      .select(Object.keys(POLICY_EDIT_FIELDS.payin).join(",")).eq("policy_id",policyId).maybeSingle(),
    admin.from("policy_intermediary_payouts")
      .select(Object.keys(POLICY_EDIT_FIELDS.payout).join(",")).eq("policy_id",policyId)
      .order("created_at",{ascending:false}).limit(1).maybeSingle(),
    admin.from("life_health_cases")
      .select(Object.keys(POLICY_EDIT_FIELDS.case).join(",")).eq("final_policy_id",policyId)
      .order("converted_at",{ascending:false}).limit(1).maybeSingle(),
    admin.from("non_motor_policy_details")
      .select(Object.keys(POLICY_EDIT_FIELDS.nonMotor).join(",")).eq("policy_id",policyId).maybeSingle(),
    admin.from("life_health_policy_details")
      .select("additional_details").eq("policy_id",policyId).maybeSingle(),
  ]);
  if (policy.error || !policy.data || premium.error || payin.error || payout.error
    || lifeCase.error || nonMotor.error || issuedDetails.error) return null;
  const snapshot: PolicyEditSnapshot = {};
  const sources: Array<[string, Record<string, string>, Record<string, unknown> | null]> = [
    ["policy", POLICY_EDIT_FIELDS.policy, policy.data as unknown as Record<string, unknown>],
    ["premium", POLICY_EDIT_FIELDS.premium, premium.data as unknown as unknown as Record<string, unknown> | null],
    ["payin", POLICY_EDIT_FIELDS.payin, payin.data as unknown as unknown as Record<string, unknown> | null],
    ["payout", POLICY_EDIT_FIELDS.payout, payout.data as unknown as unknown as Record<string, unknown> | null],
    ["case", POLICY_EDIT_FIELDS.case, lifeCase.data as unknown as unknown as Record<string, unknown> | null],
    ["nonMotor", POLICY_EDIT_FIELDS.nonMotor, nonMotor.data as unknown as unknown as Record<string, unknown> | null],
  ];
  for (const [prefix, fields, data] of sources) {
    for (const key of Object.keys(fields)) {
      const value = data?.[key];
      snapshot[`${prefix}.${key}`] = value === undefined || value === null ? null : String(value).trim();
    }
  }
  // Store only field labels: never persist raw issued-schedule JSON in an audit record.
  const additional = (issuedDetails.data as { additional_details?: unknown } | null)?.additional_details;
  const schedule = additional && typeof additional === "object" && !Array.isArray(additional)
    ? (additional as unknown as Record<string, unknown>).issued_schedule : null;
  const issuedSchedule = schedule && typeof schedule === "object" && !Array.isArray(schedule)
    ? schedule as unknown as Record<string, unknown> : null;
  for (const key of Object.keys(POLICY_EDIT_FIELDS.issuedSchedule)) {
    const value = issuedSchedule?.[key];
    snapshot[`issuedSchedule.${key}`] = value === undefined || value === null ? null : String(value).trim();
  }
  return snapshot;
}

export function changedPolicyEditFields(before: PolicyEditSnapshot | null, after: PolicyEditSnapshot | null): string[] | null {
  if (!before || !after) return null;
  const names: string[] = [];
  const groups = POLICY_EDIT_FIELDS as Record<string, Record<string, string>>;
  for (const [prefix, fields] of Object.entries(groups)) {
    for (const [key, label] of Object.entries(fields)) {
      const fullKey = `${prefix}.${key}`;
      if (before[fullKey] !== after[fullKey]) names.push(label);
    }
  }
  return [...new Set(names)];
}

// Only these explicitly approved policy-facing fields may have historical
// values written into audit logs. Do not log raw customers, identifiers,
// insurer pay-in/payout commissions, remarks, or arbitrary form JSON.
const DISPLAYABLE_PREMIUM_VALUES = new Set([
  "premium.od_premium", "premium.tp_premium",
  "premium.cpa_amount", "premium.cpa_opted", "premium.add_on_premium",
]);
const DERIVED_PREMIUM_AUDIT_LABEL = "Premium totals recalculated (source edit not recorded)";
const LEGACY_DERIVED_PREMIUM_LABELS = new Set([
  "Net premium", "GST", "Gross premium", "Premium",
  "Projected insurer pay-in", "Total projected pay-in", "Partner payout amount",
]);
const DERIVED_PREMIUM_FIELDS = new Set([
  "premium.net_premium", "premium.gst_amount", "premium.gross_premium",
  "policy.premium_amount", "payin.projected_commission_amount",
  "payin.total_projected_payin", "payout.partner_payout_amount",
]);
const AUTO_REVIEW_STATUS_FIELDS = new Set(["payin.commercial_status","payout.commercial_status"]);
const DISPLAYABLE_PUBLIC_VALUES = new Set([
  "policy.status","policy.business_line","policy.policy_type","policy.policy_product",
  "policy.issuance_date","policy.start_date","policy.end_date","policy.policy_term",
  "case.product_name","case.premium_paying_term","case.policy_duration",
  "case.payment_frequency","case.payment_mode",
]);
function formatPublicAuditValue(raw:string|null):string {
  if(!raw)return "Not set";
  return /^[a-zA-Z0-9 ._\/-]{1,70}$/.test(raw)?raw:"Changed";
}
const activityLabel=(value:string)=>value.split(":")[0].replace(/ changed \(values hidden\)$/, "");
function formatAuditedPremiumValue(key: string, raw: string | null): string {
  if (raw === null || raw === "") return "Not set";
  if (key === "premium.cpa_opted") return raw === "true" ? "Yes" : raw === "false" ? "No" : "Not set";
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1000000000
    ? `₹${amount.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    : "Changed";
}

/** Actual editable differences; exclude auto-recalculated totals from the
 * activity headline when a source premium was edited. Existing older audit
 * entries remain truthful about the limited historical data recorded. */
export function describePolicyEditChanges(before: PolicyEditSnapshot | null, after: PolicyEditSnapshot | null): string[] | null {
  if (!before || !after) return null;
  const groups = POLICY_EDIT_FIELDS as Record<string, Record<string, string>>;
  const entries: Array<{key:string;label:string}> = [];
  for (const [prefix, fields] of Object.entries(groups))
    for (const [key, label] of Object.entries(fields)) {
      const fullKey = `${prefix}.${key}`;
      if (before[fullKey] !== after[fullKey]) entries.push({key:fullKey,label});
    }
  const premiumSourceChanged = entries.some(entry=>DISPLAYABLE_PREMIUM_VALUES.has(entry.key));
  const cpaAmountChanged=entries.some(entry=>entry.key==="premium.cpa_amount");
  const sourceEntries = entries.filter(entry => !DERIVED_PREMIUM_FIELDS.has(entry.key)
      && !(cpaAmountChanged && entry.key==="premium.cpa_opted")
      && !(premiumSourceChanged && AUTO_REVIEW_STATUS_FIELDS.has(entry.key)));
  if (sourceEntries.length === 0 && entries.some(entry => DERIVED_PREMIUM_FIELDS.has(entry.key)))
    return [DERIVED_PREMIUM_AUDIT_LABEL];
  return sourceEntries.map(entry => DISPLAYABLE_PREMIUM_VALUES.has(entry.key)
      ? `${entry.label}: ${formatAuditedPremiumValue(entry.key,before[entry.key])} → ${formatAuditedPremiumValue(entry.key,after[entry.key])}`
      : DISPLAYABLE_PUBLIC_VALUES.has(entry.key)
        ? `${entry.label}: ${formatPublicAuditValue(before[entry.key])} → ${formatPublicAuditValue(after[entry.key])}`
        : `${entry.label} changed (values hidden)`).slice(0,30);
}

function readPolicyAuditFieldChanges(raw:unknown):string[]|null {
  if(!Array.isArray(raw)) return null;
  const fieldLabels = new Set<string>(Object.values(POLICY_EDIT_FIELDS).flatMap(fields=>Object.values(fields)));
  const withValues=new Set<string>([...DISPLAYABLE_PREMIUM_VALUES,...DISPLAYABLE_PUBLIC_VALUES]
    .map(path=>{const [group,key]=path.split(".");return (POLICY_EDIT_FIELDS as Record<string,Record<string,string>>)[group]?.[key];})
    .filter((label):label is string=>Boolean(label)));
  const accepted:string[]=[];
  let hasDerivedOnlyLegacyLabels=false;
  for(const item of raw.slice(0,30)){
    if(typeof item!=="string"||item.length>180)continue;
    if (item === DERIVED_PREMIUM_AUDIT_LABEL) { accepted.push(item); continue; }
    if(fieldLabels.has(item)){
      // Preserve the meaning of older records without inferring source edits.
      if (LEGACY_DERIVED_PREMIUM_LABELS.has(item)) hasDerivedOnlyLegacyLabels=true;
      else accepted.push(item);
      continue;
    }
    const hidden=item.match(/^(.*?) changed \(values hidden\)$/);
    if(hidden&&fieldLabels.has(hidden[1])){accepted.push(item);continue;}
    const parsed=item.match(/^(.*?): (.*?) → (.*?)$/);
    if(parsed&&withValues.has(parsed[1])){
      const isAmount=["OD premium","TP premium","CPA amount","Add-on premium"].includes(parsed[1]);
      const isBoolean=parsed[1]==="CPA opted";
      const safe=(value:string)=>isBoolean?/^(Yes|No|Not set)$/.test(value)
        :isAmount?/^(₹[0-9,]+[.][0-9]{2}|Not set|Changed)$/.test(value)
        :/^(?:[a-zA-Z0-9 ._\/-]{1,70}|Not set|Changed)$/.test(value);
      if(safe(parsed[2])&&safe(parsed[3]))accepted.push(item);
    }
  }
  return accepted.length?accepted:hasDerivedOnlyLegacyLabels?[DERIVED_PREMIUM_AUDIT_LABEL]:raw.length?null:[];
}

function policyEditTitle(changed: string[] | null): string {
  if (!changed) return "Policy updated — change details unavailable";
  if (changed.length === 0) return "Policy saved — no tracked field changes";
  if (changed.length === 1 && changed[0] === DERIVED_PREMIUM_AUDIT_LABEL) return "Premium totals recalculated";
  if (changed.length > 1) {
    const remaining = changed.length - 2;
    return `${activityLabel(changed[0])}, ${activityLabel(changed[1])}${remaining ? ` + ${remaining} more` : ""} updated`;
  }
  const single = activityLabel(changed[0]);
  if (single === "Policy number") return "Policy number changed";
  if (single === "Policy status") return "Policy status changed";
  if (single === "Insurer") return "Insurer changed";
  if (/premium|pay-in|payout|GST|incentive|rate/i.test(single)) return `${single} updated`;
  return `${single} updated`;
}

export async function recordPolicyActivity(
  admin: AdminClient,
  policyId: string,
  actorId: string | null,
  action: PolicyActivityAction,
  changedFields?: string[] | null,
) {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    table_name: ACTIVITY_TABLE_NAME,
    record_id: policyId,
    ...(action === POLICY_ACTIVITY_ACTIONS.POLICY_EDITED
      ? { new_data: { changed_fields: changedFields ?? null } }
      : {}),
  });
  return !error;
}

export async function loadPolicyActivityHistory({
  policyId,
  createdBy,
  createdAt,
  updatedAt,
}: {
  policyId: string;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}): Promise<PolicyActivityDisplay[]> {
  const admin = createSupabaseAdminClient();

  const [auditResult, documentResult, lifeHealthCaseResult] = await Promise.all([
    admin
      .from("audit_logs")
      .select("id,actor_id,action,created_at,new_data")
      .eq("table_name", ACTIVITY_TABLE_NAME)
      .eq("record_id", policyId)
      .in("action", TRACKED_ACTIONS)
      .order("created_at", { ascending: false })
      .returns<AuditRow[]>(),
    admin
      .from("policy_documents")
      .select("uploaded_by,created_at,updated_at")
      .eq("policy_id", policyId)
      .eq("document_type", "policy_copy")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<DocumentRow>(),
    admin
      .from("life_health_cases")
      .select("id,created_at,created_by,converted_at,converted_by")
      .eq("final_policy_id", policyId)
      .order("converted_at", { ascending: false })
      .limit(1)
      .maybeSingle<LifeHealthCaseActivityRow>(),
  ]);

  const auditRows = auditResult.data ?? [];
  const candidates: ActivityCandidate[] = [];
  const auditActions = new Set<AuditedPolicyActivityAction>();

  for (const row of auditRows) {
    const action = asTrackedAction(row.action);
    if (!action) continue;
    auditActions.add(action);
    candidates.push({
      id: `audit:${row.id}`,
      action,
      actorId: row.actor_id,
      actorName: reconciliationActorName(action, row.actor_id),
      approvedBy: action === POLICY_ACTIVITY_ACTIONS.PREVIOUS_MONTH_POLICY_UPLOADED ? row.new_data?.approved_by : null,
      policyDate: action === POLICY_ACTIVITY_ACTIONS.PREVIOUS_MONTH_POLICY_UPLOADED ? row.new_data?.issuance_date : null,
      changedFields: action === POLICY_ACTIVITY_ACTIONS.POLICY_EDITED
        && Array.isArray(row.new_data?.changed_fields)
        ? readPolicyAuditFieldChanges(row.new_data.changed_fields)
        : null,
      at: row.created_at,
    });
  }

  const lifeHealthCase = lifeHealthCaseResult.data;
  if (lifeHealthCase?.created_at) {
    candidates.push({
      id: `life-health-case:${lifeHealthCase.id}:created`,
      action: POLICY_ACTIVITY_ACTIONS.LIFE_HEALTH_CASE_CREATED,
      actorId: lifeHealthCase.created_by,
      at: lifeHealthCase.created_at,
    });
  }
  if (lifeHealthCase?.converted_at) {
    candidates.push({
      id: `life-health-case:${lifeHealthCase.id}:closed`,
      action: POLICY_ACTIVITY_ACTIONS.LIFE_HEALTH_CASE_CLOSED,
      actorId: lifeHealthCase.converted_by,
      at: lifeHealthCase.converted_at,
    });
  }

  if (createdAt && !lifeHealthCase && !auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_CREATED)) {
    candidates.push({
      id: "derived:policy-created",
      action: POLICY_ACTIVITY_ACTIONS.POLICY_CREATED,
      actorId: null,
      actorName: createdBy,
      at: createdAt,
    });
  }

  if (
    updatedAt
    && materiallyLater(updatedAt, createdAt)
    && !auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_EDITED)
  ) {
    candidates.push({
      id: "derived:legacy-policy-edited",
      action: POLICY_ACTIVITY_ACTIONS.POLICY_EDITED,
      actorId: null,
      at: updatedAt,
    });
  }

  const hasDocumentAudit = auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_DOC_UPLOADED)
    || auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REPLACED)
    || auditActions.has(POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REMOVED);
  const document = documentResult.data;
  if (!hasDocumentAudit && (document?.updated_at || document?.created_at)) {
    const replaced = materiallyLater(document.updated_at, document.created_at);
    candidates.push({
      id: "derived:legacy-policy-document",
      action: replaced ? POLICY_ACTIVITY_ACTIONS.POLICY_DOC_REPLACED : POLICY_ACTIVITY_ACTIONS.POLICY_DOC_UPLOADED,
      actorId: document.uploaded_by,
      at: replaced ? document.updated_at : document.created_at,
    });
  }

  const actorIds = Array.from(new Set(candidates.map((candidate) => candidate.actorId).filter((id): id is string => Boolean(id))));
  const actorNames = new Map<string, string>();

  if (actorIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id,full_name")
      .in("id", actorIds)
      .returns<ProfileRow[]>();

    for (const profile of profiles ?? []) {
      const name = profile.full_name?.trim();
      if (name) actorNames.set(profile.id, name);
    }
  }

  return candidates
    .filter((candidate) => timestamp(candidate.at) > 0)
    .sort((a, b) => timestamp(b.at) - timestamp(a.at))
    .map((candidate) => ({
      id: candidate.id,
      action: candidate.action === POLICY_ACTIVITY_ACTIONS.POLICY_EDITED
        ? policyEditTitle(candidate.changedFields ?? null)
        : ACTION_LABELS[candidate.action],
      actorName: candidate.actorName?.trim() || (candidate.actorId ? actorNames.get(candidate.actorId) : null) || "Not recorded",
      changes: candidate.action === POLICY_ACTIVITY_ACTIONS.POLICY_EDITED
        ? candidate.changedFields?.map(field => field === DERIVED_PREMIUM_AUDIT_LABEL
          ? "Calculated premium totals changed; the original source edit was not captured"
          : field.includes(" → ") || field.includes(" changed (") ? field : `${field} changed (previous/new values not stored)`) ?? null
        : null,
      meta: candidate.action === POLICY_ACTIVITY_ACTIONS.POLICY_EDITED
        ? candidate.changedFields === null || candidate.changedFields === undefined
          ? "The original edited field and previous/new values were not recorded"
          : candidate.changedFields.includes(DERIVED_PREMIUM_AUDIT_LABEL)
            ? "Only calculated totals were recorded; the edited source and historical values are unavailable"
            : candidate.changedFields.length
              ? undefined
              : "No tracked field values changed"
        : candidate.action === POLICY_ACTIVITY_ACTIONS.PREVIOUS_MONTH_POLICY_UPLOADED
          ? (candidate.approvedBy ? "Approved by: " + candidate.approvedBy : "Uploaded within the permitted date window")
            + " · Uploaded by: " + (candidate.actorId ? actorNames.get(candidate.actorId) ?? "Not recorded" : "Not recorded")
            + (candidate.policyDate ? " · Insurance date: " + candidate.policyDate : "")
          : undefined,
      at: candidate.at,
    }));
}
