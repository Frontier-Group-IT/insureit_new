import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const logger = await readFile(new URL("../lib/performance-observability.ts", import.meta.url), "utf8");
assert.match(logger, /console\.info\("portal_route_perf"/, "Route timing logger should use the dedicated event name.");
assert.doesNotMatch(logger, /access[_-]?token|refresh[_-]?token|email|phone|policy_no|customer_code|file_name/i, "Route timing logger must not expose sensitive fields.");

for (const file of [
  "../app/customers/page.tsx",
  "../app/vehicles/page.tsx",
  "../app/policies/page.tsx",
  "../app/claims/page.tsx",
]) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  assert.match(source, /logPortalRoutePerformance\(/, `${file}: expected route timing instrumentation`);
  assert.match(source, /auth_ms:/, `${file}: expected auth phase timing`);
  assert.match(source, /scope_ms:/, `${file}: expected scope phase timing`);
  assert.match(source, /data_ms:/, `${file}: expected data phase timing`);
  assert.match(source, /total_ms:/, `${file}: expected total timing`);
}

console.log("Register performance observability regression passed.");
