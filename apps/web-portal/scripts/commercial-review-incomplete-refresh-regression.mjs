import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../app/policies/commercial-review/commercial-review-client.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/policies/commercial-review/actions.ts", import.meta.url), "utf8");

assert.match(client, /const incompleteStatuses = new Set<LedgerStatus>\(\["not_entered", "needs_review"\]\)/, "Incomplete is status-based, not amount-based.");
assert.match(client, /const \[savedStatuses, setSavedStatuses\]/, "Successful saves must update visible statuses immediately.");
assert.match(client, /useEffect\(\(\) => \{[\s\S]*?setSavedStatuses\(\{\}\);[\s\S]*?\}, \[rows\]\)/, "Server refresh must replace optimistic status.");
assert.match(client, /displayedRows\.reduce<Record<LedgerStatus, number>>/, "Counters must use the displayed statuses.");
assert.match(client, /return displayedRows\.filter\(\(row\) =>/, "Filters must use the displayed statuses.");
assert.match(client, /reflectSavedStatus\(\[row\.id\], side, "entered"\);/, "Row save must leave incomplete immediately.");
assert.match(client, /if \(result\.updated === policyIds\.length/, "Bulk optimistic status must be restricted to fully updated batches.");
assert.match(client, /reflectSavedStatus\(\[row\.id\], side, nextStatus\);/, "Explicit row status actions must update visible status.");
assert.match(client, /router\.refresh\(\)/, "All successful updates must reconcile with server records.");
assert.match(client, /Pay-In status/, "Pay-In status must be labeled separately.");
assert.match(client, /Payout status/, "Payout status must be labeled separately.");
assert.match(client, /Rates entered · review status/, "Rates entered with incomplete status must be flagged, not automatically approved.");
assert.match(actions, /commercial_status: nextStatus/, "Server must persist explicit commercial status.");
assert.match(actions, /revalidatePath\("\/policies\/commercial-review"\)/, "Server must invalidate the commercial review route.");
// Regression: switching between POSPs and a Partner must never retain ghost table rows
// or selected policies from the previous intermediary.
assert.match(client, /if \(intermediary !== "all" && row\.intermediaryCode !== intermediary\) return false;/, "Intermediary filtering must compare exact policy codes.");
assert.match(client, /const tableFilterKey = JSON\.stringify\(\[side, query, insurer, intermediary, intermediaryType, vehicleClass, registrationType, status, backfill, dateFrom, dateTo\]\)/, "Table remount key must include intermediary and all displayed filters.");
assert.match(client, /<tbody key=\{tableFilterKey\} className="divide-y divide-\[#EDF0F4\]">\{filteredRows\.map\(\(row\) =>/, "Visible DOM rows must be replaced from the same filtered array as the counters.");
assert.match(client, /function changeIntermediary\(value: string\) \{[\s\S]*?setIntermediary\(value\);[\s\S]*?setSelected\(new Set\(\)\);[\s\S]*?setEditingId\(null\);/, "Switching intermediary must clear prior row selection and edit state.");
assert.match(client, /onChange=\{\(e\) => changeIntermediary\(e\.target\.value\)\}/, "Intermediary selector must use the safe handler.");

console.log("Commercial review incomplete refresh and status reconciliation regression passed.");

const registrationPage = await readFile(new URL("../app/policies/commercial-review/page.tsx", import.meta.url), "utf8");
const registrationSource = await readFile(new URL("../app/policies/commercial-review/registration-filter.ts", import.meta.url), "utf8");
assert.ok(registrationPage.includes('id,vehicle_type,registration_status,vehicle_no'));
assert.ok(registrationPage.includes("classifyCommercialRegistration(row)"));
assert.ok(client.includes('useState<CommercialRegistrationFilter>("all")'));
assert.ok(client.includes('matchesCommercialRegistration(row.registrationType, registrationType)'));
assert.ok(client.includes('changeRegistrationType("all")'));
assert.ok(client.includes('flex-nowrap items-center gap-2 overflow-x-auto'));
assert.ok(client.includes('All reg type'));
assert.ok(client.includes('filteredRows.filter(row => selected.has(row.id))'));
assert.ok(registrationSource.includes('status === "registration_pending"'));
assert.ok(registrationSource.includes('status === "registered"'));
assert.ok(registrationSource.includes('filter === "all" || value === filter'));

const filterCss = await readFile(new URL("../app/policies/commercial-review/commercial-review-filters.module.css", import.meta.url), "utf8");
assert.ok(client.includes('import filterStyles from "./commercial-review-filters.module.css"'));
assert.ok(client.includes('${filterStyles.compactFilter}'));
assert.equal((client.match(/className=\{compactFilterClass\}/g) ?? []).length, 6);
assert.match(filterCss, /select\.compactFilter:focus\s*\{[^}]*border-color: #D8DEE9;[^}]*box-shadow: none;[^}]*outline: none;/);
assert.match(filterCss, /select\.compactFilter:focus-visible\s*\{[^}]*border-color: #315B9A;[^}]*box-shadow: inset/);
