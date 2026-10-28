import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../app/customer/(protected)/claims/", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root), "utf8");
const register = read("page.tsx");
const detail = read("[id]/page.tsx");
const stage = read("[id]/stage/[stage]/page.tsx");

assert.match(register, /externalProjection\?\.current_stage\.key/);
assert.match(register, /internalProjection\?\.stageIndex/);
assert.match(register, /href=\{stageHref\}/, "Claim row must use current-stage route");
assert.match(register, /<Link key=\{claim\.id\} href=\{stageHref\}/, "Entire claim card must link to its current-stage route");
assert.doesNotMatch(register, />View Details<|>Continue\s*</, "Claim cards must not have separate View Details or Continue buttons");
assert.match(detail, /externalProjection\?\.current_stage\.key/);
assert.match(detail, /internalProjection\?\.stageIndex/);
assert.doesNotMatch(stage, /Continue to Stage \{activeIndex \+ 2\}/, "Completed stages must not show continuation");
assert.doesNotMatch(stage, /\{completed && activeIndex < INTERNAL_JOURNEY_STAGES\.length - 1/, "Completed-stage footer must be removed");
assert.match(stage, /editMode && canEditStage/, "Editable current-stage form must remain gated");
console.log("Customer claim current-stage navigation regressions passed");
