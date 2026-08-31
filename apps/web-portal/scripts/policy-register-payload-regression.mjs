import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/policies/page.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../app/policies/policy-workspace.tsx", import.meta.url), "utf8");

const mainQuery = page.match(/let query = admin\.from\("policies"\)\.select\("([^"]+)"\)/)?.[1] ?? "";
assert.ok(mainQuery, "Policies page should keep an explicit main register select.");
assert.ok(!mainQuery.includes("premium_amount"), "Main policy register should not fetch unused premium_amount.");
assert.ok(!mainQuery.includes("mime_type"), "Main policy register should not fetch unused policy document mime_type.");
assert.ok(mainQuery.includes("policy_premium_details(gross_premium)"), "Gross premium used by the register must remain.");
assert.ok(mainQuery.includes("policy_documents(id, document_type, file_name)"), "Policy copy identity and file name must remain for open action.");
assert.ok(page.includes('select("id,policy_no,policy_type,start_date,end_date,insured_declared_value,premium_amount,'), "Backoffice premium display must remain unchanged.");
assert.ok(!workspace.includes("premium_amount: number | null;"), "Policy workspace type should not retain unused premium_amount.");
assert.ok(!workspace.includes("mime_type: string | null;"), "Policy workspace document type should not retain unused mime_type.");

console.log("Policy register payload regression passed.");
