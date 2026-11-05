import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../components/customer-portal/customer-claim-stage-submit.tsx", import.meta.url), "utf8");
const sharedDialog = readFileSync(new URL("../components/claim-manager/claim-stage-error-dialog.tsx", import.meta.url), "utf8");
assert.match(src, /<ClaimStageErrorDialog message=\{errorPopup\}/, "Customer claim stage uses the shared centered error popup");
assert.match(sharedDialog, /role="alertdialog"/);
assert.match(sharedDialog, /aria-modal="true"/);
assert.match(sharedDialog, /Check details/, "Error popup shows the requested Check details heading");
assert.match(sharedDialog, /AlertCircle/, "Error popup uses the standard orange warning icon");
assert.match(sharedDialog, /h-11 w-full rounded-xl bg-\[#19385E\]/, "Error popup has a full-width navy OK action");
assert.doesNotMatch(src, /Action required|border-red-100/, "Remove the old compact red error dialog");
assert.match(src, /setErrorPopup\(result.error\)/);
assert.match(src, /setErrorPopup\(error instanceof Error/);
assert.ok(src.includes('onClose={() => setErrorPopup("")}'), "OK dismisses claim-stage error dialog");
assert.match(src, /className="relative flex flex-wrap items-center justify-end gap-2"/, "Footer buttons need a stable positioning context.");
assert.match(src, /role="status" aria-live="polite" className="pointer-events-none absolute right-0 top-full/, "Draft saved feedback must not participate in footer button layout.");
assert.doesNotMatch(src, /role="status" aria-live="polite" className="w-full/, "Full-width feedback must not shift Cancel vertically.");
assert.match(src, /mode === "draft" \? "Draft saved\." : "Details saved\."/);

assert.doesNotMatch(src, /bg-\[#FFF3F3\]/);
const { readFileSync: read } = await import("node:fs");
const draft = read(new URL("../components/customer-portal/customer-claim-stage-draft-form.tsx", import.meta.url), "utf8");
const page = read(new URL("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx", import.meta.url), "utf8");
const actions = read(new URL("../app/customer/(protected)/claims/[id]/stage/[stage]/actions.ts", import.meta.url), "utf8");
const spot = read(new URL("../app/customer/(protected)/spot-intimation/spot-intimation-save-form.tsx", import.meta.url), "utf8");
const spotPage = read(new URL("../app/customer/(protected)/spot-intimation/page.tsx", import.meta.url), "utf8");
const choice = read(new URL("../components/customer-portal/customer-claim-boolean-choice.tsx", import.meta.url), "utf8");
assert.match(page, /CustomerClaimStageDraftForm id="customer-claim-stage-details-form"/, "Customer stage details must be draft-protected");
assert.doesNotMatch(page, /<form id="customer-claim-stage-details-form" action=/, "No second native action path must remain");
assert.match(draft, /event\.preventDefault\(\)/, "Enter must use the guarded submit handler");
assert.match(draft, /window\.sessionStorage\.setItem\(key/, "Drafts must be saved on input");
assert.match(draft, /restoreCustomerClaimDraft\(form, key\)/, "Stage values must restore on return");
assert.match(draft, /customerClaimStageDraftKey\(accountId, claimId, stage\)/, "Draft keys must isolate accounts, claims and stages");
assert.match(draft, /\["account", "claim", "stage"\]/, "Drafts must exclude authorization identifiers");
assert.match(choice, /data-choice-value=\{key\}/, "Yes/No inputs must be restorable");
assert.match(src, /saveCustomerClaimDraft\(form, key\)/, "Snapshot values immediately before remote save");
assert.match(src, /clearCustomerClaimDraft\(key\)/, "Clear only on a successful save");
assert.match(src, /if \(result\.error\)/, "Do not discard local data after server errors");
assert.match(actions, /await saveCustomerExternalStage\(form, false\)/, "Server validation must report success without RSC form reset");
assert.match(actions, /return \{error:null, destination\}/, "Return a safe success destination");
assert.match(actions, /const destination = key === "payment_encashment"\s*\? "\/customer\/claims\?account="\+encodeURIComponent\(account\.id\)/, "Successful Stage 9 saves, including completed-stage edits, must return to the scoped Claims Register.");
assert.match(actions, /: editingCompleted && key !== "work_approval"\s*\? "\/customer\/claims\/"\+encodeURIComponent\(claim\.id\)\+"\/stage\/"/, "Other earlier completed stages must retain their edit destination; Stage 4 is the explicit continue-to-Stage-5 exception.");
assert.match(actions, /if \(navigate\) redirect\(destination\)/, "Preserve existing server action navigation.");
assert.match(src, /if \(result\.destination\) router\.push\(result\.destination\)/, "Final navigation remains conditional on successful save.");

assert.doesNotMatch(spot, /useActionState\(/, "Spot Intimation errors must not reset uncontrolled form inputs");
assert.match(spot, /event\.preventDefault\(\)/, "Spot Intimation must preserve inputs on failed submit");
assert.match(spot, /if \(result\.error\)/, "Spot Intimation server errors must retain entered fields");
assert.match(spot, /if \(result\.destination\)/, "Spot Intimation drafts clear only after successful save");
assert.match(spotPage, /return \{error:null,destination:/, "Spot Intimation success should navigate after client-side draft cleanup");

const customerPdfRoute = read(new URL("../app/customer/(protected)/claims/[id]/download/route.ts", import.meta.url), "utf8");
const operationsPdfRoute = read(new URL("../app/claims/[id]/download/route.ts", import.meta.url), "utf8");
const operationsPage = read(new URL("../app/claims/[id]/page.tsx", import.meta.url), "utf8");
const customerPage = read(new URL("../app/customer/(protected)/claims/[id]/page.tsx", import.meta.url), "utf8");
const pdfRenderer = read(new URL("../lib/completed-claim-pdf.ts", import.meta.url), "utf8");
for (const route of [customerPdfRoute,operationsPdfRoute]) {
  assert.match(route, /INTERNAL_JOURNEY_STAGES\.every\(stage\s*=>\s*completedKeys\.has\(stage\.key\)\)/,
    "Both PDF routes must require all nine completed milestones.");
  assert.match(route, /renderCompletedClaimPdf\(/, "Both portals must use the same Claim PDF layout.");
}
assert.match(operationsPdfRoute, /requireCapability\("view_claims"\)/, "Operations PDF must authenticate role permissions.");
assert.match(operationsPdfRoute, /canAccessCustomer\(profile\.id, profile\.role, claim\.customer_id, "view_claims"\)/,
  "Operations PDF must preserve claim/customer scope.");
assert.match(operationsPdfRoute, /new URL\(request\.url\)\.searchParams\.get\("preview"\) === "1"/,
  "Operations PDF must support inline preview and attachment download.");
assert.match(operationsPage, /allNineCompletedForPdf/, "Operations buttons must appear only for nine completed stages.");
assert.match(operationsPage, /Open PDF/);
assert.match(operationsPage, /Download PDF/);
assert.match(customerPage, /const source = isExternalCustomerClaim\(claim\) \? "External" : "Internal"/,
  "Customer must continue supporting internal and external claim PDFs.");
assert.match(customerPage, /Open PDF/);
assert.match(customerPage, /Download Claim Form/);
assert.match(pdfRenderer, /claim\.policy_service_source === "external" \|\| Boolean\(claim\.external_policy_id\)/,
  "Shared PDF renderer must label external versus internal correctly.");
assert.match(pdfRenderer, /new NextResponse\(new Uint8Array\(bytes\)/, "PDF response must remain a real downloadable PDF.");

console.log("Customer claim stage draft/error preservation regressions passed");
