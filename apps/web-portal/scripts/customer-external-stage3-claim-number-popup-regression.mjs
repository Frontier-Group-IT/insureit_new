import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = relative => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const page = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const actions = read("../app/customer/(protected)/claims/[id]/stage/[stage]/actions.ts");
const popup = read("../components/customer-portal/customer-insurer-claim-number-popup.tsx");
const submit = read("../components/customer-portal/customer-claim-stage-submit.tsx");

assert.match(page, /q\.saved==="claim_intimation" && selected\.key==="work_approval" && external/, "Popup must follow successful external Stage 3 only.");
assert.match(page, /item\.milestone_key === "claim_intimation" && item\.milestone_status === "completed"/, "Stage 3 completion must be persisted.");
assert.match(page, /!claim\.insurer_claim_no\?\.trim\(\)/, "Do not prompt when number already exists.");
assert.match(page, /<CustomerInsurerClaimNumberPopup/, "Stage 4 must render popup.");
assert.match(page, /stage\/work_approval\?account=/, "Popup must continue into Stage 4.");
assert.match(actions, /key==="claim_intimation"\?"&saved=claim_intimation":""/, "Only first completion should mark transition.");
assert.match(submit, /saveCustomerClaimStageWithFeedback\(mode, data\)/, "Stage 3 must first save on the server.");

assert.match(popup, /Add insurer claim number\?/, "Match reference heading.");
assert.match(popup, /placeholder="Enter claim number"/);
assert.match(popup, />\s*Not now\s*<\/button>/, "Optional skip is required.");
assert.match(popup, /Saving\.\.\." : "Continue"/, "Continue action must show save state.");
assert.match(popup, /role="dialog" aria-modal="true"/);
assert.match(popup, /router\.replace\(destination\)/, "Dismiss the one-time query parameter.");
assert.match(popup, /if \(!value\)/, "Require a number only on Continue.");
assert.match(popup, /setError\(result\.error\)/, "Show safe errors without losing text.");
assert.match(popup, /saveCustomerExternalInsurerClaimNumber\(accountId, claimId, value\)/);

assert.match(actions, /export async function saveCustomerExternalInsurerClaimNumber/, "Must use server-scoped action.");
assert.match(actions, /resolveCustomerWebScope\(accountId\)/);
assert.match(actions, /loadCustomerClaimDetail\(account\.id, claimId\)/);
assert.match(actions, /isExternalCustomerClaim\(claim\)/, "Internal claims must be excluded.");
assert.match(actions, /stageThree\.milestone_status/, "Must verify persisted Stage 3 milestone.");
assert.match(actions, /if \(claim\.insurer_claim_no\?\.trim\(\)\)/, "Cannot overwrite existing number.");
assert.match(actions, /\.eq\("id", claim\.id\)/);
assert.match(actions, /\.eq\("customer_id", account\.id\)/);
assert.match(actions, /\.is\("insurer_claim_no", null\)/, "Concurrent updates must not overwrite.");
assert.match(actions, /\.select\("id"\)\s*\.maybeSingle\(\)/, "Require evidence update succeeded.");
assert.doesNotMatch(actions.slice(actions.indexOf("export async function saveCustomerExternalInsurerClaimNumber"), actions.indexOf("/** Save incomplete Stage 3")), /service_role|createSupabaseAdminClient|claim_milestones"\)\.update/, "No privileged bypass or stage update.");
console.log("External Stage 3 optional insurer claim number popup regression passed.");
