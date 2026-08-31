import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const newPage = await readFile(new URL("../app/policies/external/new/page.tsx", import.meta.url), "utf8");
const editPage = await readFile(new URL("../app/policies/external/[id]/edit/page.tsx", import.meta.url), "utf8");

assert.ok(newPage.includes("getActiveInsuranceCompanyOptions()"), "External Policy New should reuse cached active insurers.");
assert.ok(editPage.includes("getActiveInsuranceCompanyOptions()"), "External Policy Edit should reuse cached active insurers.");
assert.ok(!newPage.includes('.eq("is_active", true).order("name", { ascending: true })'), "External Policy New should not query active insurers directly.");
assert.ok(!editPage.includes('.eq("is_active", true).order("name", { ascending: true }).returns<InsurerRow[]>()'), "External Policy Edit should not query active insurers directly.");
assert.ok(
  editPage.includes('admin.from("insurance_companies").select("id,name,is_active").eq("id", policy.insurance_company_id)'),
  "External Policy Edit must keep the current-insurer lookup for inactive historical values.",
);
assert.ok(editPage.includes("!currentInsurerResult.data.is_active"), "Inactive current insurer handling must remain explicit.");
assert.ok(editPage.includes("— Inactive"), "Inactive current insurer should remain labeled clearly.");

console.log("External policy insurer cache regression passed.");
