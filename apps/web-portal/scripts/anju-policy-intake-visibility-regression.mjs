import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/policy-intakes/page.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/policy-intake-workspace.tsx", import.meta.url), "utf8");

assert.match(page, /organizationViewer = \["super_admin", "admin", "it_super_user"\]/);
assert.match(page, /if \(organizationViewer\) return "all"/);
assert.match(page, /return reviewer \? "action" : "all"/);
assert.match(page, /!organizationViewer && !reviewer/);
assert.match(page, /if \(intakeOrFilter\) page = page\.or\(intakeOrFilter\)/);
assert.match(page, /resetView=\{organizationViewer \? "all" : undefined\}/);
assert.match(workspace, /setView\(resetView \?\? \(reviewer \? "action" : "all"\)\)/);
console.log("Anju super admin policy intake visibility regression passed");
