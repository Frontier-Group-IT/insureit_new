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
const tableHeader = workspace.slice(workspace.indexOf("<thead className="), workspace.indexOf("</thead>"));
assert.ok(tableHeader.includes(">Insurer / Policy</th>"), "First intake queue column must be labeled Insurer / Policy");
const tableFirstCell = workspace.slice(workspace.indexOf('<td className="px-3">'), workspace.indexOf("</td>", workspace.indexOf('<td className="px-3">')));
assert.ok(tableFirstCell.includes('getInsurerLogo(field(row, "insurer_name"))'), "First column must reuse the insurer logo lookup");
assert.ok(tableFirstCell.includes('field(row, "policy_number")'), "First column must display the policy number");
assert.ok(tableFirstCell.includes("{row.file_name}"), "Existing secondary filename line must remain unchanged");
assert.ok(!tableFirstCell.includes("{row.intake_number}"), "First column must not display the intake identifier as primary text");
console.log("Anju super admin policy intake visibility regression passed");
