import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
export type TrackedPolicyChange = { field: string; before: string | null; after: string | null };
export type PolicyChangeSnapshot = Record<string, string | null>;

// Deliberate allowlist: no customer PII, credentials, raw notes, or private
// commission/payout values are written into user-facing activity metadata.
export const POLICY_CHANGE_FIELDS: Record<string, { label: string; kind?: "money" | "date" | "masked" }> = {
  "policy.policy_no": { label: "Policy number" },
  "policy.policy_type": { label: "Policy type" },
  "policy.policy_product": { label: "Policy product" },
  "policy.business_line": { label: "Business line" },
  "policy.insurance_company_id": { label: "Insurance company", kind: "masked" },
  "policy.issuance_date": { label: "Issuance date", kind: "date" },
  "policy.start_date": { label: "Policy start date", kind: "date" },
  "policy.end_date": { label: "Policy expiry date", kind: "date" },
  "policy.tp_valid_upto": { label: "TP expiry date", kind: "date" },
  "policy.cpa_valid_upto": { label: "CPA expiry date", kind: "date" },
  "policy.premium_amount": { label: "Policy premium", kind: "money" },
  "policy.insured_declared_value": { label: "IDV / Sum insured", kind: "money" },
  "policy.rm_name": { label: "Relationship manager" },
  "policy.lead_source": { label: "Lead source" },
  "policy.status": { label: "Policy status" },
  "premium.od_premium": { label: "OD premium", kind: "money" },
  "premium.tp_premium": { label: "TP premium", kind: "money" },
  "premium.cpa_amount": { label: "CPA amount", kind: "money" },
  "premium.cpa_opted": { label: "CPA opted" },
  "premium.add_on_premium": { label: "Add-on premium", kind: "money" },
  "premium.net_premium": { label: "Net premium", kind: "money" },
  "premium.gross_premium": { label: "Gross premium", kind: "money" },
  "life.product_name": { label: "Life/Health product" },
  "life.proposal_number": { label: "Proposal number" },
  "life.premium_paying_term": { label: "Premium paying term" },
  "life.policy_duration": { label: "Policy duration" },
  "life.payment_frequency": { label: "Payment frequency" },
  "life.payment_mode": { label: "Payment mode" },
  "life.premium_amount": { label: "Proposal premium", kind: "money" },
  "schedule.ppt_end_date": { label: "PPT end date", kind: "date" },
  "schedule.next_installment_date": { label: "Next installment date", kind: "date" },
};

function normalize(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return null;
}
function addSnapshot(target: PolicyChangeSnapshot, prefix: string, values: Record<string, unknown> | null) {
  if (!values) return;
  for (const [key, value] of Object.entries(values)) {
    const field = `${prefix}.${key}`;
    if (POLICY_CHANGE_FIELDS[field]) target[field] = normalize(value);
  }
}

/** Read-only, whitelisted snapshot. Null indicates a query failed; never fabricate a diff. */
export async function capturePolicyChangeSnapshot(
  admin: AdminClient,
  policyId: string,
  includeLifeHealth = false,
): Promise<PolicyChangeSnapshot | null> {
  try {
    const [policy, premium, life, details] = await Promise.all([
      admin.from("policies")
        .select("policy_no,policy_type,policy_product,business_line,insurance_company_id,issuance_date,start_date,end_date,tp_valid_upto,cpa_valid_upto,premium_amount,insured_declared_value,rm_name,lead_source,status")
        .eq("id", policyId).maybeSingle(),
      admin.from("policy_premium_details")
        .select("od_premium,tp_premium,cpa_amount,cpa_opted,add_on_premium,net_premium,gross_premium")
        .eq("policy_id", policyId).maybeSingle(),
      includeLifeHealth
        ? admin.from("life_health_cases")
          .select("product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount")
          .eq("final_policy_id", policyId).order("converted_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      includeLifeHealth
        ? admin.from("life_health_policy_details")
          .select("additional_details").eq("policy_id", policyId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (policy.error || premium.error || life.error || details.error || !policy.data) return null;
    const snapshot: PolicyChangeSnapshot = {};
    addSnapshot(snapshot, "policy", policy.data as Record<string, unknown>);
    addSnapshot(snapshot, "premium", premium.data as Record<string, unknown> | null);
    addSnapshot(snapshot, "life", life.data as Record<string, unknown> | null);
    if (includeLifeHealth && details.data) {
      const extra = (details.data as { additional_details?: Record<string, unknown> | null }).additional_details;
      const schedule = extra?.issued_schedule;
      if (schedule && typeof schedule === "object" && !Array.isArray(schedule)) {
        addSnapshot(snapshot, "schedule", schedule as Record<string, unknown>);
      }
    }
    return snapshot;
  } catch (error) {
    console.error("Policy audit snapshot unavailable", { policyId, error });
    return null;
  }
}

export function diffPolicyChangeSnapshots(before: PolicyChangeSnapshot | null, after: PolicyChangeSnapshot | null): TrackedPolicyChange[] | null {
  if (!before || !after) return null;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((field) => POLICY_CHANGE_FIELDS[field] && before[field] !== after[field]).map((field) => ({
    field,
    before: before[field] ?? null,
    after: after[field] ?? null,
  }));
}

function display(value: string | null, kind?: "money" | "date" | "masked"): string {
  if (kind === "masked") return "Changed";
  if (value == null) return "Not set";
  if (kind === "money" && Number.isFinite(Number(value))) {
    return "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  return value.length > 80 ? value.slice(0, 77) + "…" : value;
}

/** Render only the known, allowed field IDs. Never trust audit JSON labels. */
export function policyChangeDescription(changes: TrackedPolicyChange[]): { title: string; detail: string } {
  const safe = changes.filter((item) =>
    item && typeof item.field === "string" && POLICY_CHANGE_FIELDS[item.field]
    && (item.before == null || typeof item.before === "string")
    && (item.after == null || typeof item.after === "string")
  );
  if (!safe.length) return { title: "Policy saved", detail: "No tracked policy fields changed" };
  const title = safe.length === 1
    ? POLICY_CHANGE_FIELDS[safe[0].field].label + " updated"
    : `Policy updated — ${safe.length} fields changed`;
  const detail = safe.map((item) => {
    const field = POLICY_CHANGE_FIELDS[item.field];
    return field.kind === "masked"
      ? `${field.label} changed`
      : `${field.label}: ${display(item.before, field.kind)} → ${display(item.after, field.kind)}`;
  }).join("; ");
  return { title, detail };
}
