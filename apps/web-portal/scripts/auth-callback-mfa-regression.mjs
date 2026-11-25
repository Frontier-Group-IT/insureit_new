import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/auth/callback/page.tsx",import.meta.url),"utf8");
assert.match(page,/getAuthenticatorAssuranceLevel\(\)/);
assert.match(page,/assurance\.currentLevel !== "aal2" && assurance\.nextLevel === "aal2"/);
assert.match(page,/supabase\.auth\.mfa\.listFactors\(\)/);
assert.match(page,/factors\?\.totp\?\.find\(item => item\.status === "verified"\)/);
assert.match(page,/supabase\.auth\.mfa\.challengeAndVerify\(/);
assert.match(page,/assurance\?\.currentLevel !== "aal2"/);
assert(page.indexOf('supabase.auth.mfa.challengeAndVerify(')<page.indexOf('supabase.auth.updateUser({ password })'),
  "Password change must not precede MFA verification");
assert.match(page,/safePortalReturnPath\(destination\)/);
assert.match(page,/status === "mfa"/);
assert.doesNotMatch(page,/service_role|auth\.admin\.updateUserById|mfa\.unenroll/);
console.log("Auth callback MFA password-change contract passed.");
