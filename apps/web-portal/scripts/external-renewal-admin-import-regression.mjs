import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => { console.error(`External renewal admin import regression failed: ${message}`); process.exit(1); };

const action = read("app/master-data/external-renewal-imports/actions.ts");
const page = read("app/master-data/external-renewal-imports/page.tsx");
const form = read("app/master-data/external-renewal-imports/import-form.tsx");
const template = read("app/master-data/external-renewal-imports/template/route.ts");
const navigation = read("components/claim-manager/app-navigation.tsx");

if (!navigation.includes('label:"External Renewal Imports"') || !navigation.includes('href:"/master-data/external-renewal-imports"')) fail("Administration navigation entry is missing");
if (!page.includes('requireCapability("manage_master_data", "edit")')) fail("page is not protected by master-data edit permission");
if (!action.includes('requireCapability("manage_master_data", "edit")')) fail("upload action is not protected by master-data edit permission");
if (!template.includes('requireCapability("manage_master_data", "edit")')) fail("template download is not protected by master-data edit permission");
if (!form.includes("Download Sample Template") || !form.includes("Validate & Publish")) fail("template or upload controls are missing");
if (!action.includes('.from("external_renewal_import_batches")') || !action.includes('.from("external_renewal_opportunities")')) fail("isolated external renewal persistence is missing");
for (const verifiedTable of ["customers", "vehicles", "policies"]) {
  const directWrite = new RegExp(`\\.from\\([\\"']${verifiedTable}[\\"']\\)\\s*\\.(insert|update|upsert|delete)`, "m");
  if (directWrite.test(action)) fail(`upload action writes verified ${verifiedTable}`);
}
if (!action.includes("addCalendarYear") || !action.includes("invoice_date")) fail("invoice-date based one-calendar-year derivation is missing");
if (!action.includes("oldestAllowedEnd") || !action.includes("duplicates")) fail("expiry-window or duplicate safeguards are missing");
if (!template.includes("INSUREIT_External_Renewal_Import_Template.xlsx")) fail("standard xlsx template response is missing");

console.log("External renewal admin import regression passed.");
