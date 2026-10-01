import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const form = read("components/insurance-company-master-form.tsx");
const actions = read("app/insurance-companies/actions.ts");
const resolver = read("lib/insurer-logo.ts");
const route = read("app/api/insurer-logo/route.ts");
const migration = read("../../supabase/migrations/20261001131500_insurance_company_logo_upload.sql");

assert(form.includes('name="logo"'), "Insurer master form must expose a logo file input.");
assert(form.includes('accept="image/png,image/jpeg,image/webp"'), "Logo input must limit browser selection to PNG/JPG/WebP.");
assert(form.includes('name="remove_logo"'), "Edit form must allow reverting to the bundled logo fallback.");
assert(form.includes("maximum 2 MB"), "Form must communicate the 2 MB limit.");

assert(actions.includes("MAX_LOGO_BYTES = 2 * 1024 * 1024"), "Server action must enforce the 2 MB limit.");
assert(actions.includes('"image/png": "png"') && actions.includes('"image/jpeg": "jpg"') && actions.includes('"image/webp": "webp"'), "Server action must allow only PNG/JPG/WebP MIME types.");
assert(actions.includes("logo_path: logoPath"), "Create action must persist the uploaded logo path.");
assert(actions.includes("logo_path: nextLogoPath"), "Update action must persist replacement/removal state.");
assert(actions.includes("requireCapability(\"manage_master_data\", \"edit\")"), "Logo changes must remain behind manage_master_data edit capability.");
assert(actions.includes("path.startsWith(`${insurerId}/`)"), "Storage cleanup must be scoped to the insurer folder.");

assert(resolver.includes("getStaticInsurerLogo"), "Static GitHub logo fallback must be preserved.");
assert(resolver.includes("/api/insurer-logo?name="), "Shared insurer logo helper must use the managed resolver endpoint.");
assert(route.indexOf("managedPath") < route.indexOf("getStaticInsurerLogo"), "Managed master logo must be checked before bundled fallback.");
assert(route.includes("genericInsurerSvg"), "Resolver must provide a generic icon fallback.");
assert(route.includes("unstable_cache"), "Managed logo lookup must be cached rather than queried for every image request.");

assert(migration.includes("add column if not exists logo_path text"), "Migration must add a nullable logo_path column.");
assert(migration.includes("'insurer-assets'"), "Migration must create the insurer-assets bucket.");
assert(migration.includes("2097152"), "Storage bucket must enforce the 2 MB file limit.");
assert(migration.includes("'image/png', 'image/jpeg', 'image/webp'"), "Storage bucket must restrict MIME types.");
assert(migration.includes("true"), "Insurer branding bucket must be public for logo rendering.");

console.log("Insurer master logo upload regression passed.");
