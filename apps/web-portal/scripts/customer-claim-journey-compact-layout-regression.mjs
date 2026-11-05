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
console.log("Compact full-width customer claim journey regression passed.");
