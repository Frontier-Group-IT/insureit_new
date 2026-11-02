import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/rm-policy-intake-scope.ts", import.meta.url), "utf8");
const line = source.split("\n").find((entry) => entry.includes("const match =") && entry.includes(".exec(code)"));
assert.ok(line, "RM alias conversion must exist");
assert.ok(line.includes(String.raw`/^PT(\d{5})$/`), "Use a digit character class, not a literal backslash");
assert.ok(!line.includes(String.raw`/^PT(\\d{5})$/`), "Regression: double-escaped digit class");

const matcher = /^PT(\d{5})$/;
assert.equal(`PART-2026-${matcher.exec("PT00068")?.[1]}`, "PART-2026-00068");
assert.equal(matcher.exec("PART-2026-00068"), null);
assert.equal(matcher.exec("PT1234"), null);
assert.equal(matcher.exec("PT123456"), null);
assert.ok(source.includes("partner_branch_authorized") === false || source.includes("portal_access_identities"));
assert.ok(source.includes("submitted_by_profile_id.eq.${profileId}"));
console.log("RM policy intake legacy code regression checks passed");
