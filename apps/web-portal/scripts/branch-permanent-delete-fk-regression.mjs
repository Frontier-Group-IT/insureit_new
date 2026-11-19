import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const code = readFileSync(resolve(import.meta.dirname, "../lib/admin-permanent-delete.ts"), "utf8");
const branch = code.slice(code.indexOf("async function deleteBranch("), code.indexOf("async function deletePartner("));
assert.match(branch, /partner_branch_profiles!partner_branch_profiles_partner_id_fkey!inner/);
assert.match(branch, /if \(branchError\)/);
assert.match(branch, /if \(!branch\)/);
assert.match(branch, /const allBlockers = await blockers\("partners", partnerId\)/);
assert.match(branch, /const blocking = allBlockers\.filter/);
console.log("Branch permanent-delete lookup FK and safety regression passed");

const panel = readFileSync(resolve(import.meta.dirname, "../app/intermediaries/partner-register-client.tsx"), "utf8");
const api = readFileSync(resolve(import.meta.dirname, "../app/api/admin/permanent-delete/route.ts"), "utf8");
const dialog = readFileSync(resolve(import.meta.dirname, "../components/permanent-delete-button.tsx"), "utf8");
const onboarding = code.slice(code.indexOf("async function deletePendingPartnerApplication("), code.indexOf("export async function permanentDeleteEntity("));
assert.match(onboarding, /const allowedStatuses = new Set/);
assert.match(code, /const actor = await requireItSuperUser\(\)/);
assert.match(code, /kind === "onboarding_application"\) return deletePendingPartnerApplication\(id\)/);
for (const field of ["partner_record_id","intermediary_id","registration_record_id","completed_at","partner_activated_at"]) {
  assert.ok(onboarding.includes(field), "Pending application deletion must check "+field);
}
for (const table of ["business_referral_identities","intermediaries","intermediary_registrations","intermediary_portal_accounts","partners","partner_branch_profiles","posp_misp_import_rows"]) {
  assert.ok(onboarding.includes(table), "Pending application deletion must block "+table);
}
assert.match(onboarding, /deleted\?\.length !== 1/);
assert.match(onboarding, /guardedQuery[\s\S]*?\.is\("partner_record_id", null\)/);
assert.match(panel, /rows\.filter\(\(row\) => row\.isApplicationOnly\)/);
assert.match(panel, /kind="onboarding_application"/);
assert.match(dialog, /pending onboarding application/);
assert.match(api, /value === "onboarding_application"/);
console.log("Pending application IT deletion, exact selection and linked-history guards passed");
