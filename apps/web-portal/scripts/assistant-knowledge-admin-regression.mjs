import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAssistantKnowledgeImportPlan } from "../lib/assistant/knowledge-import.ts";

const plan = buildAssistantKnowledgeImportPlan({
  fileName: "operations-v2.xlsx",
  fileSha256: "a".repeat(64),
  actorProfileId: "profile-1",
  workbook: {
    metadata: { templateVersion: "1", contentVersion: 2, knowledgeBaseName: "Operations", owner: "Operations Excellence", classification: "internal" },
    entries: [{ route: "/claims", title: "Claim intake", content: "Use the approved intake checklist.", tags: ["claims"], sourceReference: "SOP-CLAIMS-02", requiredCapabilities: ["view_claims"], requiredAccess: "view" }],
  },
});
assert.equal(plan.importRow.content_version, 2);
assert.equal(plan.importRows[0].required_capabilities[0], "view_claims");
assert.equal(plan.importRows[0].required_access, "view");
assert.equal(plan.entries[0].required_access, "view");
assert.equal(plan.entries[0].version, 2);
assert.equal(plan.entries[0].status, "draft");
assert.equal(JSON.stringify(plan).includes("operations-v2.xlsx"), true);
assert.equal(Object.hasOwn(plan.importRow, "raw_file"), false);

assert.throws(() => buildAssistantKnowledgeImportPlan({
  fileName: "unsafe-floor.xlsx",
  fileSha256: "b".repeat(64),
  actorProfileId: "profile-1",
  workbook: {
    metadata: { templateVersion: "1", contentVersion: 3, knowledgeBaseName: "Operations", owner: "Operations Excellence", classification: "internal" },
    entries: [{ route: "/policies/new", title: "Add policy", content: "Use the policy entry form.", tags: ["policies"], sourceReference: "SOP-POLICY-03", requiredCapabilities: ["view_policies"], requiredAccess: "view" }],
  },
}), /knowledge_route_access_below_catalogue/, "workbook access cannot understate the authoritative route floor");

const alignedRoutePlan = buildAssistantKnowledgeImportPlan({
  fileName: "knowledge.xlsx",
  fileSha256: "d".repeat(64),
  actorProfileId: "00000000-0000-4000-8000-000000000002",
  workbook: {
    metadata: { templateVersion: "1", contentVersion: 4, knowledgeBaseName: "Operations", owner: "Operations Excellence", classification: "internal" },
    entries: [{ route: "/policies/new", title: "Add policy", content: "Use the policy entry form.", tags: ["policies"], sourceReference: "SOP-POLICY-04", requiredCapabilities: ["view_policies"], requiredAccess: "edit" }],
  },
});
assert.deepEqual(alignedRoutePlan.entries[0].route_required_permissions, {
  view_customers: "view",
  view_vehicles: "view",
  view_policies: "edit",
}, "staged entries persist every authoritative section, group, and item route floor");

const actions = await readFile(new URL("../app/system/assistant-knowledge/actions.ts", import.meta.url), "utf8");
for (const required of [
  '"use server"', "getAuthenticatedProfile", "getServerAccessToken", "manage_assistant_knowledge",
  "parseAssistantKnowledgeWorkbook", "createHash", "buildAssistantKnowledgeImportPlan",
  'rpc("stage_assistant_knowledge_import"', 'rpc("transition_assistant_knowledge_entry"',
  "revalidatePath", "publishAssistantKnowledgeEntry", "retireAssistantKnowledgeEntry",
]) assert.ok(actions.includes(required), `knowledge actions missing ${required}`);
assert.doesNotMatch(actions, /raw_file|file_bytes|storage\.from|console\.(?:log|error)/, "knowledge actions do not persist raw workbooks or leak content");
assert.doesNotMatch(actions, /from\("assistant_knowledge_(?:imports|import_rows|entries)"\)\.(?:insert|update|delete)/, "knowledge lifecycle writes must use atomic server-only RPCs");
assert.match(actions, /hasEffectiveCapability\([^)]*"manage_assistant_knowledge"[^)]*"approve"/, "knowledge mutations require current effective approval access");
assert.match(actions, /formData\.get\("content_reviewed"\).*!== "yes"/, "publication requires an explicit full-content review acknowledgement");

const page = await readFile(new URL("../app/system/assistant-knowledge/page.tsx", import.meta.url), "utf8");
assert.match(page, /manage_assistant_knowledge/, "knowledge page is permission guarded");
assert.match(page, /Download controlled template/, "knowledge page exposes the controlled template");
assert.match(page, /Draft|Published|Retired/, "knowledge page shows lifecycle state");
assert.doesNotMatch(page, /content\.slice\(0, 320\)/, "publication review must not hide content after a preview boundary");
assert.match(page, /<details/, "approvers have a complete expandable review surface");
assert.match(page, /\{entry\.content\}/, "complete escaped knowledge content is available before publication");
assert.match(page, /name="content_reviewed"[^>]*required/, "publish control requires an explicit review acknowledgement");
assert.match(page, /if \(error\) throw new Error\("assistant_knowledge_list_unavailable"\)/, "knowledge list failures are not presented as an empty list");

const template = await readFile(new URL("../app/api/templates/assistant-knowledge-v1/route.ts", import.meta.url), "utf8");
for (const required of ["Metadata", "Knowledge", "content_version", "Required Capabilities", "Minimum Access", "manage_assistant_knowledge", "no-store"]) {
  assert.ok(template.includes(required), `template route missing ${required}`);
}

console.log(JSON.stringify({ cases: 22, status: "ok" }));
