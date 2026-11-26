import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const get = p => readFileSync(resolve(root, p), "utf8");
const strip = get("components/customer-portal/customer-claim-stage-strip.tsx");
const journey = get("components/customer-portal/customer-internal-completed-journey.tsx");
const page = get("app/customer/(protected)/spot-intimation/page.tsx");
const server = get("app/customer/(protected)/claims/[id]/stage/[stage]/actions.ts");

assert.match(strip, />Back<\/Link>/, "Back retains link without arrow");
assert.doesNotMatch(strip, /ArrowLeft/, "Remove Back arrow");
for (const label of ["Control No.", "Policy No.", "Make & Model", "Vehicle No.", "Claim Status", "Policy Source"]) {
  assert.ok(strip.includes(`label:"${label}"`), `Header should preserve ${label}`);
}
assert.match(strip, /<img src=\{icon\} alt=""/, "Header fields use existing 3D artwork");
assert.match(strip, /<CustomerClaimLogo value=\{claimSummary\.insurer\}/, "Keep insurer logo when available");
assert.match(strip, /<CustomerClaimLogo value=\{claimSummary\.manufacturer\}/, "Keep manufacturer logo when available");
assert.doesNotMatch(journey, /<h2[^>]*>Claim Journey<\/h2>/, "Remove redundant lower Claim Journey heading");
assert.doesNotMatch(journey, /completed \{completedStages === 1/, "Remove redundant stage tally row");
assert.match(journey, /stage\.key === "spot_intimation" && !stageTwoLocked/, "Pencil hidden after verification");
assert.match(journey, /aria-label="Edit Spot Intimation"/, "Pencil-only action accessible");
assert.doesNotMatch(journey, /<Pencil[^>]*\/>Edit/, "No visible Edit text");
assert.match(page, /if\(editing && !eligible\) redirect\(detailsHref\)/, "Direct edit URLs redirect once locked");
assert.match(server, /\.eq\("customer_id", account\.id\)/, "Customer-scoped update preserved");
const rule = get("lib/claim-workflow.ts");
assert.match(rule,/initialDocumentTypes\.every\(type => documents\.some\(doc => doc\.verification_status === "verified"/);
assert.match(journey,/customerSpotVerificationLocked\(claimStatus, documents\)/);
assert.match(page,/!customerSpotVerificationLocked\(claim.current_status,documents\)/);
assert.match(server,/customerSpotVerificationLocked\(claim.current_status, documents\)/);
for(const action of ["upload-action.ts","delete-document-action.ts","reuse-policy-copy-action.ts"]) assert.match(get("app/customer/(protected)/claims/[id]/stage/[stage]/"+action),/customerSpotVerificationLocked\(claim.current_status,documents\)/);
console.log("Customer Claim Journey layout and Operations verification lock regression passed");
