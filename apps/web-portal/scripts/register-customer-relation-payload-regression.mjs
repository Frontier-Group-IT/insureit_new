import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const vehiclePage = await readFile(new URL("../app/vehicles/page.tsx", import.meta.url), "utf8");
const policyPage = await readFile(new URL("../app/policies/page.tsx", import.meta.url), "utf8");

assert.ok(!vehiclePage.includes("customers!inner(company_name, contact_name, created_by)"), "Vehicle register must not fetch unused customer created_by.");
assert.ok(!policyPage.includes("customers!inner(company_name, contact_name, created_by)"), "Policy register must not fetch unused customer created_by.");
assert.ok(!policyPage.includes("customers!inner(company_name,contact_name,created_by)"), "Backoffice Policy register must not fetch unused customer created_by.");
assert.ok(vehiclePage.includes("customers!inner(company_name, contact_name)"), "Vehicle register must keep customer display/search fields.");
assert.ok(policyPage.includes("customers!inner(company_name, contact_name)"), "Policy register must keep customer display/search fields.");
assert.ok(policyPage.includes("customers!inner(company_name,contact_name)"), "Backoffice Policy register must keep customer display fields.");

console.log("Register customer relation payload regression passed.");
