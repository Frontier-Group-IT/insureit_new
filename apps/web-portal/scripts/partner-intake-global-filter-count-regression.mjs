import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/partner/policy-intakes/route.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../../../supabase/migrations/20261107133000_partner_policy_intake_search_text.sql", import.meta.url), "utf8");

assert.match(route, /const mobileFilters = \["action_required", "in_review", "processing", "completed", "duplicate", "rejected", "all"\]/);
assert.match(route, /\.range\(offset, offset \+ limit - 1\)/, "Limit rows returned per request.");
assert.match(route, /count: "exact"/, "Return database-backed filtered count.");
assert.match(route, /includeCounts[\s\S]*get\("include_counts"\)/);
assert.match(route, /Promise\.all\(mobileFilters\.map\(/, "Exact complete status counts.");
assert.match(route, /if \(employeeRead\?\.mode === "or"\) q = q\.or\(employeeRead\.predicates\)/, "Maintain employee scope in count queries.");
assert.match(route, /else if \(employeeRead\?\.mode === "submitter"\) q = q\.eq\("submitted_by_profile_id", employeeRead\.profileId\)/);
assert.match(route, /else if \(!employeeRead\) q = q\.or\(intakeReadScope\)/, "Maintain partner scope in count queries.");
assert.match(route, /if \(employeeRead\?\.mode === "or"\) query = query\.or\(employeeRead\.predicates\)/, "Maintain employee list scope.");
assert.match(route, /else if \(!employeeRead\) query = query\.or\(intakeReadScope\)/, "Maintain partner list scope.");
assert.match(route, /query\.ilike\("policy_intake_search_text"/, "Search full authorized OCR data before pagination.");
assert.match(route, /if \(filter === "action_required"\) query = query\.or\(/);
assert.match(route, /if \(statusFilter === "action_required"\) q = q\.or\(/);
assert.match(route, /q\.eq\("status", "processing"\)\.neq\("ocr_status", "failed"\)/, "Exclude failed OCR from Processing.");
assert.match(route, /q\.in\("status", \["ready_for_review", "in_review"\]\)/);
assert.match(route, /count: "exact", head: true/, "Count without fetching full records.");
assert.match(sql, /create or replace function public\.policy_intake_search_text\(/);
assert.match(sql, /create or replace function public\.policy_intake_search_text\(\s*public\.policy_intake_requests\s*\)/, "Avoid exposing the computed field as a standalone RPC.");
assert.match(sql, /\(\$1\)\.ocr_fields::text/, "Include OCR insurer and customer values.");
assert.match(sql, /\(\$1\)\.intake_number/, "Include PIR number.");
assert.doesNotMatch(sql, /^\s*security\s+definer/im, "Computed field must not bypass security by using SECURITY DEFINER.");
console.log("Partner Intake scoped full counts, server-side search, and migration regression passed.");
