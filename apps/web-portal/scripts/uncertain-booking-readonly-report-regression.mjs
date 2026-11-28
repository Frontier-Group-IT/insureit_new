import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../../../infra/sql/audit_uncertain_policy_booking_readonly.sql",import.meta.url),"utf8");
const normalized=sql.replace(/--[^\n]*$/gm,"").toLowerCase();
for(const forbidden of [
 /\binsert\s+into\b/,/\bupdate\s+(?:public\.)?/,/\bdelete\s+from\b/,
 /\btruncate\b/,/\bdrop\s+table\b/,/\bcreate\s+(?:or\s+replace\s+)?function\b/,
 /\balter\s+table\b/,/\bperform\s+booking\b/,
])assert.equal(forbidden.test(normalized),false,"Audit must never alter canonical or booking ledgers");
for(const required of [
 "a.state='uncertain'",
 "a.failure_code='conversion_outcome_unknown'",
 "policy_intake_ai_reconciled_recovery_attempts",
 "policy_intake_ai_uiic_tractor_recovery_attempts",
 "policy_intake_ai_auto_booking_attempts",
 "policy_intake_ai_processing_queue",
 "policy_intake_onboarding_drafts",
 "policy_intake_documents",
 "policy_documents",
 "audit_logs",
 "policy_number_matches",
 "chassis_matches",
 "source_document_links",
 "current_document_count",
 "second_uncertain_no_more_booking",
 "canonical_review_no_automatic_retry",
 "source_draft_missing_reconcile_without_booking",
 "existing_policy_match_manual_link_review",
 "already_linked_never_retry",
 "uncertain_write_requires_manual_reconciliation",
 "true AS booking_mutations_prohibited"
])assert.ok(sql.includes(required),"Critical reconciliation proof missing: "+required);

// Precedence is deliberately conservative: the already-linked and second
// unknown results must stop before missing draft / no-policy interpretation.
const order=[
 "WHEN n.final_policy_id IS NOT NULL",
 "second_uncertain_no_more_booking",
 "canonical_review_no_automatic_retry",
 "source_draft_missing_reconcile_without_booking",
 "existing_policy_match_manual_link_review",
 "uncertain_write_requires_manual_reconciliation",
];
const indexes=order.map(x=>sql.indexOf(x));
assert.ok(indexes.every(x=>x>=0)&&indexes.every((x,i)=>i===0||x>indexes[i-1]),
 "Ambiguous writes must be held before evaluating missing-source evidence");

console.log("Uncertain booking evidence report remains read-only, idempotent, and never authorizes retry");
