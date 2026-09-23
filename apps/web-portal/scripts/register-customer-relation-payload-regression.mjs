import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const vehiclePage = await readFile(new URL("../app/vehicles/page.tsx", import.meta.url), "utf8");
const customerPage = await readFile(new URL("../app/customers/page.tsx", import.meta.url), "utf8");
const vehicleDetailPage = await readFile(new URL("../app/vehicles/[id]/page.tsx", import.meta.url), "utf8");
const policyPage = await readFile(new URL("../app/policies/page.tsx", import.meta.url), "utf8");

assert.ok(!vehiclePage.includes("customers!inner(company_name, contact_name, created_by)"), "Vehicle register must not fetch unused customer created_by.");
assert.ok(!policyPage.includes("customers!inner(company_name, contact_name, created_by)"), "Policy register must not fetch unused customer created_by.");
assert.ok(!policyPage.includes("customers!inner(company_name,contact_name,created_by)"), "Backoffice Policy register must not fetch unused customer created_by.");
assert.ok(vehiclePage.includes("customers:customers!vehicles_customer_id_fkey(company_name, contact_name)"), "Vehicle register must explicitly use the canonical vehicles_customer_id_fkey relation.");
assert.ok(policyPage.includes("customers!inner(company_name, contact_name)"), "Policy register must keep customer display/search fields.");
assert.ok(policyPage.includes("customers!inner(company_name,contact_name)"), "Backoffice Policy register must keep customer display fields.");
assert.ok(customerPage.includes("vehicles:vehicles!vehicles_customer_id_fkey(count)"), "Customer register vehicle counts must explicitly use vehicles_customer_id_fkey.");
assert.ok(!customerPage.includes("onboarding_status, vehicles(count)"), "Customer register must not use an ambiguous bare vehicles(count) embed.");
assert.ok(vehicleDetailPage.includes("customers:customers!vehicles_customer_id_fkey(customer_code,contact_name,phone)"), "Vehicle detail must explicitly use vehicles_customer_id_fkey.");
assert.ok(!vehicleDetailPage.includes("customers(customer_code,contact_name,phone)"), "Vehicle detail must not use an ambiguous bare customers embed.");

console.log("Register customer relation payload regression passed.");
