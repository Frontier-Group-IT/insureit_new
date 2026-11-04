import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const loader = read("app/intermediaries/intermediary-register.tsx");
const register = read("app/intermediaries/partner-register-client.tsx");
const groupDetail = read("app/intermediaries/groups/[id]/page.tsx");

assert.match(loader, /\.from\("intermediary_group_memberships"\)/);
assert.match(loader, /\.in\("partner_id", partnerBusinessIds\.slice\(index, index \+ 100\)\)/, "Never fetch unrelated Partner group relationships");
assert.match(loader, /\.is\("effective_to", null\)/, "Only current memberships may appear");
assert.match(loader, /\.from\("intermediary_groups"\)/);
assert.match(loader, /matchingGroupIds\.length === 1/, "Do not arbitrarily select one of multiple groups");
assert.match(loader, /groupId,\s*groupName,/, "The exact verified group identity must travel in the Partner row");
assert.doesNotMatch(register, /Group -<\/span>/, "Do not display the Group label prefix");
assert.match(register, /row\.groupId && row\.groupName/, "Missing groups must not be clickable");
assert.match(register, /row\.groupId && row\.groupName \? <div/, "Unassigned partners must leave the group line empty");
assert.match(register, /href={`\/intermediaries\/groups\/\$\{encodeURIComponent\(row\.groupId\)\}`}/, "Group name opens detail route");
assert.match(register, /groupName: string \| null/, "Row type includes group name");
assert.match(groupDetail, /await requireGroupAssociateManager\(id\)/, "Existing server-side Group detail authorization must remain enforced");
console.log("Partner Register verified Group link regression passed");
