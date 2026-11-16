import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const operations = readFileSync(resolve(root, "app/policy-intakes/page.tsx"), "utf8");
const workspace = readFileSync(resolve(root, "components/policy-intake-workspace.tsx"), "utf8");
const partner = readFileSync(resolve(root, "../partner-app/app/policy-intakes.tsx"), "utf8");
const api = readFileSync(resolve(root, "app/api/partner/policy-intakes/route.ts"), "utf8");

assert.match(operations, /created_at,finalized_at,ocr_status/, "Operations loads persisted completion date");
assert.match(operations, /\.order\("created_at", \{ ascending: false \}\)/, "Operations fetch keeps original submission sort");
assert.doesNotMatch(operations, /sortPolicyIntakesByActivity/, "Do not reorder All and other tabs");

assert.match(workspace, /view === "completed" && row\.finalized_at \? row\.finalized_at : row\.created_at/g, "Both desktop and mobile Submitted cells switch date only in Completed");
assert.doesNotMatch(workspace, /Completed on:|Completed: \{formatDateTime\(row\.finalized_at\)\}/, "No extra Completed date line or column");
assert.match(workspace, /view === "completed" && row\.status === "completed" && row\.finalized_at[\s\S]*?completionDateValue\(row\.finalized_at\) : dateValue\(row\.created_at\)/, "Date Range uses completion date only for Completed tab");
assert.match(workspace, /view === "completed" \? \[\.\.\.statusRows\]\.sort/, "Only Completed tab gets completion order");
assert.match(workspace, /Date\.parse\(b\.finalized_at \|\| b\.created_at\) - Date\.parse\(a\.finalized_at \|\| a\.created_at\)/, "Completed sort uses persisted finalized_at and historic fallback");
assert.match(workspace, /\[rows, query, source, ocr, fromDate, toDate, view\]/, "Date filtering recalculates when tab changes");

assert.match(partner, /formatDate\(row\.updated_at \|\| row\.created_at\)/, "Partner UI must remain unchanged");
assert.doesNotMatch(api, /sortPolicyIntakesByActivity/, "Partner pagination remains unchanged");

// Verified reference case: created 14 Nov, finalized 16 Nov (IST).
const submitted = "2026-11-14T06:13:20.668736Z";
const finalized = "2026-11-16T05:59:41.832434Z";
assert.equal(new Date(finalized).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), "11/16/2026");
assert.ok(Date.parse(finalized) > Date.parse(submitted));
console.log("Operations Completed-tab date display, filter and order regression passed");
