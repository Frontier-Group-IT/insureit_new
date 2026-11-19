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
console.log("Commercial review incomplete refresh and status reconciliation regression passed.");
