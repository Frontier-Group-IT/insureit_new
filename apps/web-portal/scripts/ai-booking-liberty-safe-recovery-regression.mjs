import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync(new URL("../../../supabase/migrations/20261126190000_ai_booking_liberty_safe_recovery_v1.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/development/ai-policy-onboarding/page.tsx",import.meta.url),"utf8");
for(const literal of [
 "policy_intake_ai_auto_booking_recovery_attempts",
 "claim_ai_auto_booking_liberty_recovery_v1",
 "finish_ai_auto_booking_liberty_recovery_v1",
 "q.parser_id='liberty_two_wheeler_tp_native_pdf'",
 "q.checks_passed=18",
 "a.state='review_required'",
 "a.failure_code='insured_name_mismatch'",
 "a.policy_id is null",
 "a.finished_at is not null",
 "a.document_id=q.document_id",
 "a.extraction_fingerprint=q.extraction_fingerprint",
 "i.final_policy_id is null",
 "i.assigned_to_profile_id is null",
 "d.is_current=true",
 "on conflict (intake_id) do nothing",
 "r.state='claimed'",
 "current_user <> 'service_role'",
])assert.ok(migration.includes(literal),"Missing recovery precommit safety: "+literal);
assert.match(migration,/state in \('claimed','booked','review_required','uncertain'\)/);
assert.doesNotMatch(migration,/\b(?:delete|truncate)\s+from\s+public\.policy_intake_ai_auto_booking_attempts\b/i);
assert.doesNotMatch(migration,/\bupdate\s+public\.policy_intake_ai_auto_booking_attempts\b/i);
assert.ok(worker.includes('claims.push({...entry,recovery:true})'));
assert.ok(worker.includes('"finish_ai_auto_booking_liberty_recovery_v1":"finish_ai_auto_booking_v1"'));
assert.ok(worker.includes('["PGRST202","42883"]'));
assert.ok(page.includes('bookingAttemptByIntake.set(attempt.intake_id'));
console.log("Automatic Liberty one-time recovery is guarded, isolated and preserves prior booking ledger");
