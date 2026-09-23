import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [login, invite, forgot, reset, shell] = await Promise.all([
  readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/invite/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/forgot-password/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/reset-password/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/auth-portal-shell.tsx", import.meta.url), "utf8"),
]);

for (const [name, source] of [["login", login], ["invite", invite], ["forgot", forgot], ["reset", reset]]) {
  assert.match(source, /AuthPortalShell/, `${name} must use the shared portal auth layout.`);
}

assert.match(invite, /error_description/, "Invite page must render Supabase redirect errors server-side.");
assert.match(invite, /This invitation link cannot be used/, "Invite page must provide a stable expired/invalid link state.");
assert.match(forgot, /resetPasswordForEmail/, "Forgot-password must continue using Supabase recovery email.");
assert.match(forgot, /redirectTo: `\$\{window\.location\.origin\}\/reset-password`/, "Recovery email must return to the reset-password route.");

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
