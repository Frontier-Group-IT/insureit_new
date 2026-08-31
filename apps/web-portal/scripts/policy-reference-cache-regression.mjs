import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cache = await readFile(new URL("../lib/reference-data-cache.ts", import.meta.url), "utf8");
const policyNew = await readFile(new URL("../app/policies/new/page.tsx", import.meta.url), "utf8");
const insurerActions = await readFile(new URL("../app/insurance-companies/actions.ts", import.meta.url), "utf8");

assert.ok(cache.includes("getActiveInsuranceCompanyOptions"), "Active insurer options should use the shared reference-data cache.");
assert.ok(cache.includes('tags: ["reference:insurance-companies"]'), "Insurer cache should have a dedicated invalidation tag.");
assert.ok(policyNew.includes("getActiveInsuranceCompanyOptions()"), "Policy New should read cached insurer options.");
assert.ok(policyNew.includes("getActiveVehicleManufacturerOptions()"), "Policy New should read cached manufacturer options.");
assert.ok(!policyNew.includes('admin.from("insurance_companies").select("id, name")'), "Policy New should not directly query active insurer options.");
assert.ok(!policyNew.includes('admin.from("vehicle_manufacturers").select("id")'), "Policy New should not directly query active manufacturer IDs.");
assert.ok(insurerActions.includes('revalidateTag("reference:insurance-companies")'), "Insurer mutations should invalidate cached policy options.");

console.log("Policy reference option cache regression passed.");
