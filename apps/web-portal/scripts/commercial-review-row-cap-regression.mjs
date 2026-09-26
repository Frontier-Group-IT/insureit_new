import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/policies/commercial-review/page.tsx", import.meta.url), "utf8");
assert.ok(page.includes('from "@/lib/fetch-all-pages"'), "Commercial review must use the shared paged loader.");
for (const table of [
  "policies",
  "policy_premium_details",
  "policy_payin_details",
  "policy_intermediary_payouts",
  "insurance_companies",
  "intermediaries",
  "commercial_control_events",
  "vehicles",
]) {
  const index = page.indexOf(`from(\"${table}\")`);
  assert.ok(index >= 0, `Commercial review should load ${table}.`);
  const vicinity = page.slice(Math.max(0, index - 120), index + 900);
  assert.ok(vicinity.includes("fetchAllPages"), `${table} must be loaded through fetchAllPages.`);
  assert.ok(vicinity.includes(".range(from, to)"), `${table} must page with an explicit range.`);
}
assert.ok(!page.includes('.limit(500).returns<EventRow[]>()'), "Commercial event history must not silently stop at 500 rows.");
console.log("Commercial review row-cap regression passed.");
