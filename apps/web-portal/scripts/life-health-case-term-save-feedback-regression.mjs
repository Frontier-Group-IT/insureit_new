import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../components/life-health-case-detail.tsx", import.meta.url)), "utf8");
assert.match(source, /const YEAR_OPTIONS=Array\.from\(\{length:50\}/, "Edit page uses Add Policy's 1–50 year options");
assert.match(source, /termOptions\(form\.ppt,true\)/, "PPT includes Single Pay and yearly options");
assert.match(source, /termOptions\(form\.pd,false\)/, "PD includes yearly options without Single Pay");
assert.match(source, /<select className=\{field\} value=\{form\.ppt\}/, "PPT should be a select");
assert.match(source, /<select className=\{field\} value=\{form\.pd\}/, "PD should be a select");
assert.match(source, /setSaveSuccess\(true\);router\.refresh\(\)/, "Show success only after successful save");
assert.match(source, /role="status" aria-live="polite"/, "Saved confirmation should be accessible");
assert.match(source, /if\(!result\.ok\)\{setError\(result\.error\);return\}/, "Failed saves must not show success");
console.log("Life Health Case term dropdown and save feedback regression passed");
