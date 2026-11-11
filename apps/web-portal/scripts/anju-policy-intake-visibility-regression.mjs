import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/policy-intakes/page.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/policy-intake-workspace.tsx", import.meta.url), "utf8");

assert.match(page, /organizationViewer = \["super_admin", "admin", "it_super_user"\]/);
assert.match(page, /if \(organizationViewer\) return "all"/);
assert.match(page, /return reviewer \? "action" : "all"/);
assert.match(page, /else if \(!reviewer\) submitterFilter = profile\.id/);
assert.match(page, /if \(intakeOrFilter\) page = page\.or\(intakeOrFilter\)/);
assert.match(page, /resetView=\{organizationViewer \? "all" : undefined\}/);
assert.match(workspace, /setView\(resetView \?\? \(reviewer \? "action" : "all"\)\)/);
const tableHeader = workspace.match(/<thead className=[\\s\\S]*?<\\/thead>/)?.[0] ?? "";
assert.match(tableHeader, />Insurer \\/ Policy<\\/th>/, "First intake queue column must be labeled Insurer / Policy");
const tableFirstCell = workspace.match(/<td className="px-3">[\\s\\S]*?<\\/td>/)?.[0] ?? "";
assert.match(tableFirstCell, /getInsurerLogo\\(field\\(row, "insurer_name"\\)\\)/, "First column must reuse the insurer logo lookup");
assert.match(tableFirstCell, /field\\(row, "policy_number"\\)/, "First column must display the policy number");
assert.match(tableFirstCell, /\\{row\\.file_name\\}/, "Existing secondary filename line must remain unchanged");
assert.doesNotMatch(tableFirstCell, /\\{row\\.intake_number\\}/, "First column must not display the intake identifier as its primary text");
console.log("Anju super admin policy intake visibility regression passed");
