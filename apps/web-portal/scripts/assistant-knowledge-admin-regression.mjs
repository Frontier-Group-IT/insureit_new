import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAssistantKnowledgeImportPlan } from "../lib/assistant/knowledge-import.ts";

const plan = buildAssistantKnowledgeImportPlan({
  fileName: "operations-v2.xlsx",
  fileSha256: "a".repeat(64),
  actorProfileId: "profile-1",
  workbook: {
    metadata: { templateVersion: "1", contentVersion: 2, knowledgeBaseName: "Operations", owner: "Operations Excellence", classification: "internal" },
    entries: [{ route: "/claims", title: "Claim intake", content: "Use the approved intake checklist.", tags: ["claims"], sourceReference: "SOP-CLAIMS-02", requiredCapabilities: ["view_claims"] }],
  },
});
assert.equal(plan.importRow.content_version, 2);
assert.equal(plan.importRows[0].required_capabilities[0], "view_claims");
assert.equal(plan.entries[0].version, 2);
assert.equal(plan.entries[0].status, "draft");
assert.equal(JSON.stringify(plan).includes("operations-v2.xlsx"), true);
assert.equal(Object.hasOwn(plan.importRow, "raw_file"), false);

const actions = await readFile(new URL("../app/system/assistant-knowledge/actions.ts", import.meta.url), "utf8");
for (const required of [
  '"use server"', "getAuthenticatedProfile", "getServerAccessToken", "manage_assistant_knowledge",
  "parseAssistantKnowledgeWorkbook", "createHash", "buildAssistantKnowledgeImportPlan",
  'from("assistant_knowledge_imports")', 'from("assistant_knowledge_import_rows")',
  'from("assistant_knowledge_entries")', "revalidatePath", "publishAssistantKnowledgeEntry", "retireAssistantKnowledgeEntry",
]) assert.ok(actions.includes(required), `knowledge actions missing ${required}`);
assert.doesNotMatch(actions, /raw_file|file_bytes|storage\.from|console\.(?:log|error)/, "knowledge actions do not persist raw workbooks or leak content");
assert.match(actions, /hasEffectiveCapability\([^)]*"manage_assistant_knowledge"[^)]*"approve"/, "knowledge mutations require current effective approval access");

const page = await readFile(new URL("../app/system/assistant-knowledge/page.tsx", import.meta.url), "utf8");
assert.match(page, /manage_assistant_knowledge/, "knowledge page is permission guarded");
assert.match(page, /Download controlled template/, "knowledge page exposes the controlled template");
assert.match(page, /Draft|Published|Retired/, "knowledge page shows lifecycle state");

const template = await readFile(new URL("../app/api/templates/assistant-knowledge-v1/route.ts", import.meta.url), "utf8");
for (const required of ["Metadata", "Knowledge", "content_version", "Required Capabilities", "manage_assistant_knowledge", "no-store"]) {
  assert.ok(template.includes(required), `template route missing ${required}`);
}

console.log(JSON.stringify({ cases: 22, status: "ok" }));
