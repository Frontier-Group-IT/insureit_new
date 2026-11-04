import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const dashboard = read("../app/dashboard-v2/dashboard-view.tsx");
const partner = read("../app/intermediaries/applications/[id]/page.tsx");
const branches = read("../app/intermediaries/groups/branches/branch-register-workspace.tsx");

const attention = dashboard.slice(dashboard.indexOf("if (item.intakeCounts)"), dashboard.indexOf("return (", dashboard.indexOf("if (item.intakeCounts)")) + 2600);
assert.match(attention, /flex min-w-0 flex-1 items-center gap-2/, "Policy Intake icon and title must stay on the left.");
assert.match(attention, /flex shrink-0 flex-col items-end/, "Policy Intake status links must be stacked on the right.");
assert.match(attention, /policy-intakes\?view=action/, "Action Required filter link must remain.");
assert.match(attention, /policy-intakes\?view=in_review/, "In Review filter link must remain.");
assert.ok(attention.indexOf("Action Required <span") < attention.indexOf("In Review <span"), "Action Required should appear above In Review.");

assert.match(partner, /nav aria-label="Partner review sections" className="!mt-0 grid grid-cols-2/, "Partner tabs must be flush against the header.");
assert.match(partner, /rounded-t-2xl rounded-b-none/, "Partner header and tabs must retain their shared edge.");
assert.match(partner, /PartnerBusinessReport applicationId=\{id\}/, "Business Report must remain present.");

assert.match(branches, /applicationBranchView \? "w-\[185px\] py-2\.5 pl-3 pr-2 text-left"/, "Partner Branch column header must align left.");
assert.match(branches, /applicationBranchView \? "py-2 pl-3 pr-2 text-left"/, "Partner Branch row names must align left.");
assert.match(branches, /branch\.branch_name/, "Branch names must remain visible.");
assert.match(branches, /applicationBranchView \? "min-w-\[1160px\]"/, "Table horizontal scrolling contract must remain.");

console.log("Operations Dashboard, Partner tabs and Branch Register layout regression passed.");
