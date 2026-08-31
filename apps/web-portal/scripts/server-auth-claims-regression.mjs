import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");

assert.match(source, /supabase\.auth\.getClaims\(accessToken\)/, "Server auth must verify the supplied access token with getClaims().");
assert.doesNotMatch(source, /supabase\.auth\.getSession\(/, "Server authorization must not trust getSession().");
assert.doesNotMatch(source, /supabase\.auth\.getUser\(accessToken\)/, "Authenticated profile resolution should not pay the Auth getUser network hop.");
assert.match(source, /typeof claims\?\.sub === "string"/, "Verified claims must provide a string subject.");
assert.match(source, /\.eq\("id", userId\)/, "Profile lookup must remain bound to the verified JWT subject.");
assert.match(source, /\.select\("id, full_name, role, is_active"\)/, "Profile authorization fields must remain unchanged.");
assert.match(source, /if \(claimsError \|\| !userId\)/, "Invalid or missing claims must fail closed.");

console.log("Server auth claims regression passed.");
