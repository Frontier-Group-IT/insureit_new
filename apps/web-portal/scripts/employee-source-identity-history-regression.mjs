import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sql = readFileSync(resolve(root, "supabase/migrations/20261113111500_employee_source_identity_booked_rm_history.sql"), "utf8");
const employeeAction = readFileSync(resolve(root, "apps/web-portal/app/employees/actions.ts"), "utf8");
const life = readFileSync(resolve(root, "apps/web-portal/app/policies/life-health-policy-actions.ts"), "utf8");
const policyNew = readFileSync(resolve(root, "apps/web-portal/app/policies/new/page.tsx"), "utf8");

function section(name, next) {
  const start = sql.indexOf(name);
  assert.ok(start !== -1, `Missing ${name}`);
  const end = next ? sql.indexOf(next, start + name.length) : sql.length;
  assert.ok(end > start, `Missing end marker for ${name}`);
  return sql.slice(start, end);
}

// Historical ownership is stored on each booked policy/case, not re-derived on a
// Partner/POSP/MISP's current-owner reassignment or name/code correction.
const booked = section("CREATE OR REPLACE FUNCTION public.sync_policy_rm_employee_id()", "CREATE OR REPLACE FUNCTION public.set_policy_source_identity()");
const updateBranch = booked.split("IF TG_OP = 'UPDATE' THEN")[1].split("IF NEW.rm_employee_id IS NOT NULL THEN")[0];
assert.ok(updateBranch.includes("RETURN NEW;"), "Policy source corrections must exit before source RM lookup");
assert.doesNotMatch(updateBranch, /NEW\.rm_employee_id\s*:=/, "Policy updates must not replace booked RM");
assert.match(booked, /IF TG_OP = 'UPDATE'/);
assert.match(booked, /NEW\.rm_employee_id := v_employee_id/, "New policies may snapshot current owner");

const source = section("CREATE OR REPLACE FUNCTION public.sync_intermediary_identity_labels()", "CREATE OR REPLACE FUNCTION public.sync_partner_master_identity_to_intermediary()");
assert.match(source, /UPDATE public\.policies/);
assert.match(source, /p\.source_intermediary_id=NEW\.id/);
assert.match(source, /UPDATE public\.life_health_cases/);
assert.match(source, /c\.intermediary_id=NEW\.id/);
assert.match(source, /UPDATE public\.policy_intake_requests/);
assert.match(source, /r\.lead_source_id=NEW\.id/);
assert.doesNotMatch(source, /SET\s+rm_(employee_id|name|code)/i, "Source name/code changes must not rewrite RM");

assert.match(sql, /ADD COLUMN IF NOT EXISTS source_intermediary_id uuid/);
assert.match(sql, /CREATE TRIGGER sync_policy_intermediary_group_snapshot_trigger\s+BEFORE INSERT ON public\.policies/);
assert.match(sql, /CREATE OR REPLACE FUNCTION public.sync_employee_canonical_identity\(\)/);
assert.match(sql, /UPDATE public\.profiles p/);
assert.match(sql, /UPDATE public\.life_health_cases c\s+SET rm_name=NEW\.full_name,rm_code=NEW\.employee_code/);
assert.match(sql, /UPDATE public\.posp_misp_onboarding_profiles o/);
assert.match(sql, /UPDATE public\.intermediary_onboarding_applications a/);
assert.match(sql, /UPDATE public\.employees report/);
assert.match(sql, /Legacy associate_id is intentionally not overwritten/);
assert.doesNotMatch(sql, /SET\s+associate_id\s*=/i, "Do not destroy legacy associate codes");

// SQL migration must be executable and avoid broadening live column-specific
// onboarding triggers (PAN, IIB and application workflow are unrelated).
assert.equal((sql.match(/AS \\$\\n/g) ?? []).length, 0, "Invalid single-dollar function opening");
assert.equal((sql.match(/^\\$;$/gm) ?? []).length, 0, "Invalid single-dollar function closing");
assert.match(sql, /v_updated:=REPLACE\\(v_definition,'associate_name, ',''\\)/);
assert.doesNotMatch(sql, /'queue_intermediary_pan_after_profile_save',/);
assert.doesNotMatch(sql, /'queue_intermediary_pan_verification_on_document_stage',/);
assert.match(sql, /'trg_sync_posp_misp_profile_to_intermediary'/);
assert.match(sql, /identity_maintenance\.employee_source_sync_backup_20261113/);
assert.match(sql, /historical policy ownership\/group changed/);
assert.match(sql, /historical case owner changed/);
assert.doesNotMatch(employeeAction, /\.from\("profiles"\)\s*\.update\(/, "Employee Edit must not perform a separate profile write");
assert.match(employeeAction, /identity synchronization could not be verified/);
assert.match(life, /source_intermediary_id:caseRow\.intermediary_id/);
assert.match(life, /rm_employee_id:caseRow\.rm_employee_id/, "Issued policy retains the case's booked RM");

assert.match(sql, /CASE WHEN o\.application_id IS NOT NULL THEN o\.associate_employee_id ELSE i\.associate_employee_id END/, "New booking uses live onboarding assignment; do not fall back when explicitly unassigned");
assert.match(life, /currentOwner \? currentOwner\.associate_employee_id : intermediary\.associate_employee_id/, "Case booking must not fall back to stale RM when onboarding is unassigned");
assert.match(life, /rm_name:currentRm\.full_name,rm_code:currentRm\.employee_code/);
assert.doesNotMatch(life, /rmName=clean\(formData\.get\("rmName"\)\),rmCode=/, "Never trust submitted RM code as identity");
assert.match(policyNew, /currentOwnerByApplication\.get\(item\.application_id!?\)/, "New policy form must show the current owner");
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonicalize_case_identity_labels\(\)/);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonicalize_intake_source_identity\(\)/);

console.log("Employee/source identity propagation and booked RM history regression passed.");
