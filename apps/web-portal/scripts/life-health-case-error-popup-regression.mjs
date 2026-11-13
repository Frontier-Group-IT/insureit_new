import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const guard = readFileSync(new URL("../components/life-health-case-error-popup-guard.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../components/life-health-case-detail.tsx", import.meta.url), "utf8");

// Matching Tailwind presentation classes caused the Reject button to be hidden
// and displayed as a spurious "Check details: Reject" popup on page load.
assert.match(guard, /const INLINE_ERROR_SELECTOR = '\[data-life-health-case-error="true"\]'/);
assert.doesNotMatch(guard, /const INLINE_ERROR_SELECTOR = "\.border-red-200\.bg-red-50"/);
assert.match(detail, /\{error\?<div role="alert" data-life-health-case-error="true"/);
assert.match(detail, /onClick=\{\(\)=>\{setRejectError\(null\);setRejectOpen\(true\)\}\}/);
assert.match(detail, /border-red-200 bg-red-50[^"]*">Reject<\/button>/);
assert.match(guard, /setMessage\(\(current\) => current \?\? text\)/);
assert.match(guard, /inlineError\.style\.display = "none"/);
console.log("Life/Health case error popup ignores Reject button while retaining genuine validation errors.");
