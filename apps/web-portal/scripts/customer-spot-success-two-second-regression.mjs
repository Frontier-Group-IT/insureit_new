import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const popup = read("../components/customer-portal/customer-spot-save-success.tsx");
const form = read("../app/customer/(protected)/spot-intimation/page.tsx");

// Only a successful completed Spot Intimation correction triggers this confirmation.
assert.ok(page.includes('q.updated==="1" && selected.key==="spot_intimation" ? <CustomerSpotSaveSuccess /> : null'));
assert.ok(form.includes('"&updated=1"'));
assert.ok(!page.includes("Spot Intimation details updated successfully.</p>"));

// Match the centered, white Operations-style confirmation. No page-covering backdrop
// or blocking pointer layer, and no changes to the stored claim or form state.
assert.ok(popup.includes('fixed inset-0'));
assert.ok(popup.includes('items-center justify-center'));
assert.ok(popup.includes('rounded-[22px]'));
assert.ok(popup.includes('bg-white'));
assert.ok(popup.includes('bg-[#E9FBF2]'));
assert.ok(popup.includes('Spot Intimation details saved.'));
assert.ok(popup.includes('pointer-events-none'));
assert.ok(popup.includes('role="status"'));
assert.ok(popup.includes('aria-live="polite"'));

// Exactly two seconds, cleanup on unmount, and no stale success on refresh/back.
assert.ok(popup.includes('window.setTimeout(() => setVisible(false), 2000)'));
assert.ok(popup.includes('window.clearTimeout(timeout)'));
assert.ok(popup.includes('url.searchParams.delete("updated")'));
assert.ok(popup.includes('window.history.replaceState(window.history.state'));
assert.ok(!popup.includes('router.refresh()'));
assert.ok(!popup.includes('window.location.reload'));

console.log("Customer Spot Intimation two-second centered success popup regression passed");
