import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("components/customer-portal/customer-claim-stage-strip.tsx","utf8");
assert.match(source,/bg-\[linear-gradient\(102deg,#23469e_0%,#175da8_55%,#2892b7_100%\)\]/,"Summary shares Claim Journey header gradient");
assert.match(source,/customer-claim-ref-stage-grid grid w-full min-w-0 grid-cols-9/,"Nine stages occupy full width");
assert.doesNotMatch(source,/min-w-\[1080px\]/,"No forced wide stage strip");
assert.match(source,/whitespace-nowrap/,"Stage titles remain on one line");
assert.match(source,/min-h-\[42px\]/,"Stage cards remain compact");
assert.match(source,/INTERNAL_JOURNEY_STAGES\.map/,"All stages remain intact");
assert.match(source,/aria-label=\{stage\.label\}/,"Accessible labels retained");
const spotPage = readFileSync("app/customer/(protected)/spot-intimation/page.tsx","utf8");
const spotForm = readFileSync("app/customer/(protected)/spot-intimation/spot-intimation-save-form.tsx","utf8");
// Hidden form inputs must not create automatic margins above the visible title.
assert.ok(!spotForm.includes('className="space-y-4 rounded-2xl border'), "No space-y margin above Spot Intimation title");
assert.ok(spotForm.includes('className="rounded-2xl border border-[#DBE4F0] bg-white p-4'), "Spot form card and padding remain intact");
assert.ok(spotPage.includes('-mx-4 -mt-4 border-b'), "Heading remains flush with card top edge");
assert.ok(spotPage.includes('className="mt-3 grid gap-x-2.5 gap-y-3'), "Input rows retain a compact gap after the heading");
// Completed stage checks must be solid green and white; active stays blue.
assert.ok(source.includes('completed?"bg-[#149568] text-white"'), "Completed stage indicator must be solid green with a white check");
assert.ok(source.includes('current?"bg-[#155EEF] text-white'), "Active stage indicator remains blue");
assert.ok(source.includes('<Check className="customer-claim-motion-check'), "Completed stage renders the check icon");
const renewals = readFileSync("app/customer/(protected)/renewals/customer-renewals-register.tsx","utf8");
assert.ok(source.includes('src="/assets/customer-3d-icons/claims.png"'), "Customer Claim Journey must use the bundled 3D claims artwork");
assert.ok(source.includes('border border-white bg-white p-1'), "Customer Claim Journey icon tile must have solid white backing");
assert.ok(!source.includes('<FolderKanban'), "Old flat folder icon must not return to Claim Journey");
assert.ok(renewals.includes('const cardTone = selected'), "Renewal card styling must be independent of due/expired counts");
assert.ok(renewals.includes('border-[#6050E5] bg-white'), "Selected renewal category uses a white surface with a visible selected border");
assert.ok(renewals.includes('border-[#E2E9F5] bg-white'), "Unselected renewal category uses a white surface");
for (const forbidden of ['bg-[#FFF0F3]', 'bg-[#FFF3F5]', 'bg-[#FFEDF1]', 'bg-[#FFECEF]']) {
  assert.ok(!renewals.includes(forbidden), "Renewal category must not reintroduce pink/red background: " + forbidden);
}
assert.ok(renewals.includes('cat.due > 0 ? <span'), "Due badge must remain visible");
assert.ok(renewals.includes('cat.expired > 0 ? <span'), "Expired badge must remain visible");
const customerJourneyCss = readFileSync("app/customer/(protected)/claims/[id]/stage/[stage]/customer-claim-reference.css", "utf8");
assert.ok(customerJourneyCss.includes(".customer-claim-ref-journey .customer-claim-motion-completed { border-color:#dce6f3; background:#fff; }"), "Completed customer journey stages use white cards with neutral borders");
assert.ok(!customerJourneyCss.includes("background:#f4fffa"), "Completed customer journey must not use a green-tinted background");
// Stage completion semantics and the filled green Customer tick remain in the shared strip.
assert.ok(source.includes('completed?"bg-[#149568] text-white"'), "Keep existing solid-green Customer tick");
const customerStagePage = readFileSync("app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx", "utf8");
const customerChoices = readFileSync("components/customer-portal/customer-claim-boolean-choice.tsx", "utf8");
assert.match(customerStagePage,/selected\.key==="payment_encashment"\?"gap-2 lg:grid-cols-5 lg:items-start"/,"Customer Payment Encashment must show all five fields on desktop.");
assert.match(customerStagePage,/selected\.key==="claim_intimation"\|\|selected\.key==="work_approval"\?"lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:items-start"/,"Other customer stage grids must retain their previous layout.");
assert.match(customerStagePage,/selected\.key==="payment_encashment"\?"":field\.type==="date"/,"Customer Stage 9 field widths must fit their columns.");
assert.match(customerStagePage,/<CustomerClaimBooleanChoice compact name=\{field\.key\}/,"All stages use compact Yes/No controls.");
assert.match(customerChoices,/compact \? "gap-2" : "max-w-\[254px\] gap-\[10px\]"/,"Compact Yes/No buttons must fit narrower desktop columns while preserving other stages.");
console.log("Compact full-width customer claim journey regression passed.");

assert.match(customerStagePage,/selected\.key==="payment_encashment"\?"lg:grid-cols-5"/,"Read-only Payment Encashment uses five desktop columns.");
assert.match(customerStagePage,/selected\.key==="payment_encashment"\?"mt-3 flex items-center justify-end gap-2"/,"Payment Encashment has no action divider.");
