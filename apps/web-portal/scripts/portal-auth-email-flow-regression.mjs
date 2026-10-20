import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [login, invite, forgot, reset, shell, recoveryApi, eligibilitySql] = await Promise.all([
  readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/invite/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/forgot-password/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/reset-password/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/auth-portal-shell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/auth/password-recovery/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../../../supabase/migrations/20261020135000_portal_password_recovery_eligibility.sql", import.meta.url), "utf8"),
]);

for (const [name, source] of [["login", login], ["invite", invite], ["forgot", forgot], ["reset", reset]]) {
  assert.match(source, /AuthPortalShell/, `${name} must use the shared portal auth layout.`);
}

assert.match(invite, /error_description/, "Invite page must render Supabase redirect errors server-side.");
assert.match(invite, /This invitation link cannot be used/, "Invite page must provide a stable expired/invalid link state.");
assert.match(forgot, /fetch\("\/api\/auth\/password-recovery"/, "Forgot-password must use server-side portal eligibility.");
assert.match(recoveryApi, /admin\.auth\.resetPasswordForEmail/, "Recovery API must continue using Supabase Auth recovery.");
assert.match(recoveryApi, /new URL\("\/reset-password", request\.url\)/, "Recovery email must return to the reset-password route.");
assert.match(eligibilitySql, /revoke all on function public\.portal_password_recovery_eligibility/, "Eligibility function must not be callable publicly.");
assert.match(eligibilitySql, /grant execute on function public\.portal_password_recovery_eligibility\(text\) to service_role/, "Eligibility function must remain service-role-only.");

assert.match(reset, /onAuthStateChange/, "Reset-password must observe Supabase recovery auth events.");
assert.match(reset, /PASSWORD_RECOVERY/, "Reset-password must require a recovery auth event when applicable.");
assert.match(reset, /exchangeCodeForSession\(code\)/, "Reset-password must support PKCE recovery codes.");
assert.match(reset, /supabase\.auth\.getSession\(\)/, "Reset-password must verify that a recovery session exists.");
assert.match(reset, /status !== "ready"/, "Password update must fail closed unless recovery is ready.");
assert.match(reset, /supabase\.auth\.updateUser\(\{ password \}\)/, "Password update must continue using Supabase Auth.");
assert.match(reset, /This password reset link cannot be used/, "Expired or invalid recovery links must be explicit.");

assert.match(shell, /BrandLockup/, "Shared auth layout must keep the InsureIT brand lockup.");
assert.match(shell, /max-w-\[470px\]/, "Shared auth layout must keep the approved compact auth card width.");

console.log("Portal auth email-flow regression passed.");
