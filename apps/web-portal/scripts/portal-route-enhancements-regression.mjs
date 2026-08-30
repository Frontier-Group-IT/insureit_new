import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const routeEnhancements = await readFile(new URL("../components/portal-route-enhancements.tsx", import.meta.url), "utf8");

assert.ok(!layout.includes('from "@/components/embedded-master-save-bridge"'), "Root layout should not eagerly import embedded master bridge.");
assert.ok(!layout.includes('from "@/components/legacy-intermediary-import-link"'), "Root layout should not eagerly import legacy intermediary helper.");
assert.ok(!layout.includes('from "@/components/success-popup"'), "Root layout should not eagerly import success popup.");
assert.match(layout, /<PortalRouteEnhancements \/>/, "Root layout should mount the route-scoped enhancement wrapper.");

assert.match(routeEnhancements, /dynamic\(/, "Route enhancements should lazy-load optional helpers.");
assert.ok(routeEnhancements.includes('pathname === "/vehicles"'), "Embedded bridge should remain available on Vehicles.");
assert.ok(routeEnhancements.includes('pathname === "/customers"'), "Embedded bridge should remain available on Customers.");
assert.ok(routeEnhancements.includes('/^\\/intermediaries\\/applications\\/'), "Legacy intermediary helper should remain route-scoped.");
assert.ok(routeEnhancements.includes('searchParams.has("success") || searchParams.has("error")'), "Success/error popup support should remain available.");

console.log("Portal route enhancement performance regression passed.");
