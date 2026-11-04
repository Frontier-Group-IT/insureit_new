import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [customerPage, customerForm, action, operations, migration] = await Promise.all([
  read("../app/customer/(protected)/spot-intimation/page.tsx"),
  read("../app/customer/(protected)/spot-intimation/spot-intimation-save-form.tsx"),
  read("../app/customer/(protected)/spot-intimation/draft-actions.ts"),
  read("../app/claims/[id]/page.tsx"),
  read("../../../supabase/migrations/20261104165000_customer_spot_draft_sync.sql"),
]);

assert.match(customerPage, /saveServerDraft=\{claim\.current_status === "Draft"/,
  "Both Internal and External forms must autosave only while Draft");
assert.match(customerPage, /saveCustomerSpotDraft\.bind\(null, account\.id, claim\.id\)/,
  "Draft save must be bound to authenticated account and claim");
assert.match(customerPage, /serverDraft=\{serverDraft\}/,
  "Customer page should hydrate saved server draft");
assert.match(customerPage, /finalize_self_managed_external_claim_draft/,
  "External claim final submit must remain separate");
assert.match(customerPage, /"Initial Documents Pending"/,
  "Existing Internal final submission must remain separate");
assert.match(customerForm, /sessionStorage\.setItem\(storageKey/,
  "Local draft fallback must remain for offline/network failures");
assert.match(customerForm, /saveServerDraft\(values\)/,
  "Form should autosave inputs to server");
assert.match(customerForm, /onBlurCapture=/,
  "Blur must prompt immediate server save when switching to document upload");
assert.match(customerForm, /Draft not synced yet/,
  "Failed draft sync must be visible; do not claim save was successful");
assert.match(customerForm, /Only clear the local draft after the backend confirms the save/,
  "Final submission must preserve local drafts on errors");
assert.match(action, /resolveCustomerWebScope\(accountId\)/,
  "Draft writes require authenticated customer scope");
assert.match(action, /loadCustomerClaimDetail\(account\.id, claimId\)/,
  "Draft writes require claim ownership verification");
assert.match(action, /claim\.current_status !== "Draft"/,
  "Unsubmitted drafts must never modify progressed claims");
assert.match(action, /from\("claim_spot_intimation_drafts"\)\.upsert/,
  "Draft must persist in dedicated protected table");
assert.doesNotMatch(action, /from\("claims"\)\.update|from\("claim_milestones"\)\.upsert/,
  "Autosave must never advance a claim or complete a milestone");
assert.match(operations, /claim\.current_status === "Draft"/,
  "Operations must only read draft while claim is unsubmitted");
assert.match(operations, /mergeCustomerSpotDraft\(submittedSpotDetails, spotDraft\?\.fields\)/,
  "Operations must map saved draft fields for both claim types");
assert.match(operations, /submitted\.incident_at \?\? timestamp\("accidentDate"/,
  "Official values must always take precedence over unsent draft");
assert.match(operations, /submitted\.driver_name \?\? get\("driver"\)/,
  "Driver name should be available to Operations before submission");
assert.match(operations, /submitted\.location \?\? get\("location"\)/,
  "Location should be available to Operations before submission");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.claim_spot_intimation_drafts/,
  "Dedicated draft storage migration required");
assert.match(migration, /ENABLE ROW LEVEL SECURITY/,
  "Draft data must be protected by RLS");
assert.match(migration, /can_access_claim\(\(SELECT auth\.uid\(\)\), c\.id\)/,
  "Draft RLS must verify claim ownership");
assert.match(migration, /c\.current_status = 'Draft'/,
  "Draft writes must be blocked after final submission");
assert.doesNotMatch(migration, /ALTER TABLE public\.claims|CREATE TRIGGER/,
  "Draft migration cannot alter existing claim status triggers");

console.log("Internal and External customer Spot Intimation draft sync regression passed.");
