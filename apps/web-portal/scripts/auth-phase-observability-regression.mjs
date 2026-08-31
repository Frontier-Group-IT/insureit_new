import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");

assert.ok(source.includes('console.info("portal_auth_perf"'), "Auth phase timing should be emitted in production.");
assert.ok(source.includes("claims_ms:"), "Auth timing should include claims verification time.");
assert.ok(source.includes("profile_ms:"), "Auth timing should include profile lookup time.");
assert.ok(source.includes("total_ms:"), "Auth timing should include total auth time.");
assert.ok(source.includes("supabase.auth.getClaims(accessToken)"), "Verified getClaims authentication must remain in place.");

for (const forbidden of ["accessToken,", "userId,", "email:", "full_name:", "profile.id"]) {
  assert.ok(!source.includes(`portal_auth_perf", {\n      ${forbidden}`), `Auth timing must not log sensitive identity data: ${forbidden}`);
}

console.log("Auth phase observability regression passed.");
