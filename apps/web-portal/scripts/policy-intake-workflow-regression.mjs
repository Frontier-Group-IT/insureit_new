import fs from "node:fs";
import assert from "node:assert/strict";
import { roleCapabilities } from "../lib/roles.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const salesCreators = ["director", "sales_head", "zonal_head", "asm", "sales_manager", "relationship_manager"];
for (const role of salesCreators) {
  assert(roleCapabilities[role].includes("view_policy_intakes"), `${role} must view policy intakes`);
  assert(roleCapabilities[role].includes("create_policy_intakes"), `${role} must create policy intakes`);
  assert(!roleCapabilities[role].includes("review_policy_intakes"), `${role} must not review/finalize policy intakes`);
}

assert(roleCapabilities.sales_operations_head.includes("view_policy_intakes"), "Operations Head must view policy intakes");
assert(roleCapabilities.sales_operations_head.includes("review_policy_intakes"), "Operations Head must review policy intakes");
assert(roleCapabilities.sales_operations_head.includes("create_policies"), "Operations Head needs governed policy-create authority to finalize reviewed intakes");
assert(roleCapabilities.backoffice_executive.includes("view_policy_intakes"), "Backoffice must view policy intakes");
assert(roleCapabilities.backoffice_executive.includes("review_policy_intakes"), "Backoffice must review policy intakes");
assert(!roleCapabilities.backoffice_executive.includes("create_policy_intakes"), "Backoffice intake role must remain reviewer, not sales submitter");
for (const role of ["claims_head", "claim_processor", "field_executive"]) {
  assert(!roleCapabilities[role].includes("view_policy_intakes"), `${role} must not inherit policy intake access`);
}

const actions = read("app/policy-intakes/actions.ts");
assert(actions.includes('canAccessIntermediary(profile.id, profile.role, leadSourceId, "view_intermediaries")'), "Submission must re-check lead-source scope server-side");
assert(actions.includes('.from("policy_intake_requests").insert('), "Submission must write the separate intake artefact");
assert(!/from\(["']policies["']\)\s*\.insert\(/.test(actions), "Sales intake submission must never insert a real policy");
assert(actions.includes('storagePath = `intakes/${id}/'), "Policy copy must use the isolated intake storage prefix");
assert(actions.includes('createSignedUrl(data.storage_path, 300)'), "Policy-copy access must use a short-lived signed URL");
assert(actions.includes('assigned_to_profile_id:profile.id'), "Review claiming must record the reviewer");

const listPage = read("app/policy-intakes/page.tsx");
assert(listPage.includes('if(!reviewer) query=query.eq("submitted_by_profile_id",profile.id)'), "Non-reviewers must only see their own intake submissions");

const handoff = read("app/policy-intakes/handoff-actions.ts");
assert(handoff.includes('buildPolicyOcrOnboardingUpdate'), "Operations handoff must reuse the governed OCR onboarding mapper");
assert(handoff.includes('cpaOpted:"No"'), "OCR liability amount must not silently opt owner-driver CPA in");

const migration = read("../../supabase/migrations/202608240001_policy_intake_workflow.sql");
assert(migration.includes("create table if not exists public.policy_intake_requests"), "Intake table migration missing");
assert(migration.includes("enable row level security"), "Intake table must enable RLS");
assert(migration.includes("revoke all on public.policy_intake_requests from anon, authenticated"), "Browser roles must not receive direct intake-table access");
assert(migration.includes("grant all on public.policy_intake_requests to service_role"), "Only server/service-role access should be granted by migration");

const permissionManagement = read("lib/permission-management.ts");
assert(permissionManagement.includes('view_policy_intakes: { module: "Policies"'), "Legacy/effective permission catalogue must expose intake viewing");
assert(permissionManagement.includes('review_policy_intakes: "edit"'), "Backoffice ceiling must explicitly allow intake review at edit only");

const navigation = read("components/claim-manager/app-navigation.tsx");
assert(navigation.includes('key:"policy-intakes"'), "Fleet navigation must contain a Policy Intakes group");
assert(navigation.includes('href:"/policy-intakes/new"'), "Sales intake creation link missing");

console.log("policy intake workflow regression: ok");
