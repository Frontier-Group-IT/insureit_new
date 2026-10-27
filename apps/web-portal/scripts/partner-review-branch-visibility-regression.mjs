import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const section = read("app/intermediaries/applications/[id]/associate-accounts/partner-branch-sections.tsx");
const register = read("app/intermediaries/groups/branches/branch-register-workspace.tsx");
const create = read("app/intermediaries/groups/branches/new/actions.ts");

assert.match(section, /type="hidden" name="parent_partner_id" value=\{partner\.id\}/, "The parent Partner association must remain hidden and submitted.");
assert.doesNotMatch(section, /<label[^>]*>Parent Partner<input/, "The visible Parent Partner input must be removed.");
assert.match(section, /<BranchRegisterWorkspace[^>]*embedded hideParentPartner/, "Partner review register must hide Parent Partner.");
assert.match(register, /hideParentPartner = false/, "Other registers must retain Parent Partner by default.");
assert.match(register, /!hideParentPartner \? <th[^>]*>Parent Partner<\/th> : null/, "Parent Partner table heading should be conditional.");
assert.match(register, /!hideParentPartner \? <td/, "Parent Partner table cells should be conditional.");
assert.match(register, /hideParentPartner \? "Search branch, email, phone, code, Group or employee"/, "The scoped search placeholder should omit Parent Partner.");
assert.match(register, /!hideParentPartner \? <div[^>]*>/, "Mobile cards should conditionally hide the parent Partner.");
assert.match(create, /parent_partner_id/, "The server create action must preserve parent Partner linkage.");
console.log("Partner Branch Parent Partner visibility regression passed.");
