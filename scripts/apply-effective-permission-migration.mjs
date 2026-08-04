import fs from "node:fs";

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, text) { fs.writeFileSync(file, text); }
function ensureImport(text, line) {
  if (text.includes(line)) return text;
  const useServer = text.startsWith('"use server";');
  if (useServer) return text.replace('"use server";\n', `"use server";\n\n${line}\n`);
  return `${line}\n${text}`;
}
function replace(file, from, to) {
  let text = read(file);
  if (typeof from === "string") {
    if (!text.includes(from)) return false;
    text = text.replaceAll(from, to);
  } else {
    if (!from.test(text)) return false;
    text = text.replace(from, to);
  }
  write(file, text);
  return true;
}
function effective(file) {
  let text = read(file);
  text = ensureImport(text, 'import { hasEffectiveCapability, hasAnyEffectiveCapability } from "@/lib/effective-permissions";');
  write(file, text);
}

// Central guards support explicit minimum levels.
{
  const file = "apps/web-portal/lib/master-data-server.ts";
  let text = read(file);
  text = text.replace('export async function requireCapability(capability: Capability) {', 'export async function requireCapability(capability: Capability, minimumAccess?: "view" | "edit" | "approve") {');
  text = text.replace('if (!(await hasEffectiveCapability(profile, capability))) redirect("/access-denied");', 'if (!(await hasEffectiveCapability(profile, capability, minimumAccess))) redirect("/access-denied");');
  write(file, text);
}

// Critical permissions require the critical/approve level by default.
{
  const file = "apps/web-portal/lib/permission-management.ts";
  let text = read(file);
  text = text.replace('roleAccess: capability.startsWith("view_") ? "view" : capability.startsWith("approve_") || capability.startsWith("activate_") ? "approve" : "edit",', 'roleAccess: capability.startsWith("view_") ? "view" : definition.risk === "critical" || capability.startsWith("approve_") || capability.startsWith("activate_") ? "approve" : "edit",');
  write(file, text);
}

// Core user and claim workflow actions.
{
  const file = "apps/web-portal/app/actions.ts";
  effective(file);
  replace(file, 'if (!canManageUsers(profile?.role)) {', 'if (!(await hasEffectiveCapability(profile, "manage_users", "approve"))) {');
  replace(file, 'if (!canUpdateClaimStage(profile?.role)) {', 'if (!(await hasEffectiveCapability(profile, "manage_claims", "edit"))) {');
  replace(file, 'if (!canVerifyClaimDocuments(profile?.role)) {', 'if (!(await hasEffectiveCapability(profile, "manage_claims", "edit"))) {');
}

const claimFiles = [
  "apps/web-portal/app/claims/[id]/spot-survey-actions.ts",
  "apps/web-portal/app/claims/[id]/survey-done-actions.ts",
  "apps/web-portal/app/claims/[id]/surveyor-actions.ts",
  "apps/web-portal/app/claims/[id]/verification-actions.ts",
  "apps/web-portal/components/final-documents/final-documents-actions.ts",
  "apps/web-portal/components/spot-survey/survey-done-actions.ts",
];
for (const file of claimFiles) {
  effective(file);
  replace(file, /!canVerifyClaimDocuments\(profile\?\.role\)/g, '!(await hasEffectiveCapability(profile, "manage_claims", "edit"))');
  replace(file, /!canUpdateClaimStage\(profile\?\.role\)/g, '!(await hasEffectiveCapability(profile, "manage_claims", "edit"))');
}

// Customer creation/editing belongs to Customers, not master data.
const customerManageFiles = [
  "apps/web-portal/app/customers/actions.ts",
  "apps/web-portal/app/customers/corporate-actions.ts",
  "apps/web-portal/app/customers/dealership-actions.ts",
  "apps/web-portal/app/customers/group-actions.ts",
];
for (const file of customerManageFiles) {
  effective(file);
  replace(file, /!canManageMasterData\(profile\.role\)/g, '!(await hasEffectiveCapability(profile, "manage_customers", "edit"))');
}

// Intermediary onboarding actions use intermediary capabilities.
const intermediaryManagerFiles = [
  "apps/web-portal/app/customers/posp-misp/actions.ts",
  "apps/web-portal/app/customers/posp-misp/import/bulk-delete-actions.ts",
  "apps/web-portal/app/customers/posp-misp/import/bulk-submit-actions.ts",
  "apps/web-portal/app/customers/posp-misp/import/bulk-submit-v2-actions.ts",
  "apps/web-portal/app/customers/posp-misp/import/update-row-v2-actions.ts",
  "apps/web-portal/app/customers/posp-misp/manual-actions-v2.ts",
];
for (const file of intermediaryManagerFiles) {
  effective(file);
  replace(file, /!canManagePospMispOnboarding\(profile\.role\)/g, '!(await hasAnyEffectiveCapability(profile, ["create_intermediary_application", "review_intermediary_application"]))');
}

// Employee, user and organisation administration.
{
  const file = "apps/web-portal/app/employees/new/page.tsx"; effective(file);
  replace(file, 'if (!profile?.id || !canManageUsers(profile.role)) redirect("/access-denied");', 'if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_employees", "edit"))) redirect("/access-denied");');
}
{
  const file = "apps/web-portal/app/employees/page.tsx"; effective(file);
  replace(file, 'if (!profile?.id || !hasCapability(profile.role, "view_employees")) redirect("/access-denied");', 'if (!profile?.id || !(await hasEffectiveCapability(profile, "view_employees", "view"))) redirect("/access-denied");');
  replace(file, 'const canManage = canManageUsers(profile.role);', 'const canManage = await hasEffectiveCapability(profile, "manage_employees", "edit");');
}
{
  const file = "apps/web-portal/app/employees/actions.ts"; effective(file);
  replace(file, /if \(!profile\?\.id \|\| !\["it_super_user", "admin", "super_admin"\]\.includes\(String\(profile\.role\)\)\) \{/g, 'if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_employees", "edit"))) {');
}
{
  const file = "apps/web-portal/app/organization/page.tsx"; effective(file);
  replace(file, 'if (!canViewOrganizationTree(profile?.role)) redirect("/access-denied");', 'if (!(await hasEffectiveCapability(profile, "view_org_tree", "view"))) redirect("/access-denied");');
}
{
  const file = "apps/web-portal/app/users/page.tsx"; effective(file);
  replace(file, 'if (!canManageUsers(profile?.role)) redirect("/access-denied");', 'if (!(await hasEffectiveCapability(profile, "manage_users", "approve"))) redirect("/access-denied");');
}

// Intermediary account administration.
for (const file of [
  "apps/web-portal/app/intermediaries/portal-account-actions.ts",
  "apps/web-portal/app/intermediaries/resend-portal-invite-action.ts",
]) {
  effective(file);
  replace(file, /!hasCapability\(reviewer\.role, "review_intermediary_application"\)/g, '!(await hasEffectiveCapability(reviewer, "review_intermediary_application", "edit"))');
}
for (const file of [
  "apps/web-portal/app/intermediaries/applications/[id]/account-delete-actions.ts",
  "apps/web-portal/app/intermediaries/applications/[id]/layout.tsx",
]) {
  effective(file);
  replace(file, /hasCapability\(reviewer\.role, "manage_system"\)/g, 'await hasEffectiveCapability(reviewer, "manage_system", "approve")');
}

// Policy and fleet editing use their own module permissions.
for (const file of [
  "apps/web-portal/app/policies/[id]/edit/page.tsx",
  "apps/web-portal/app/policies/policy-ocr-actions.ts",
]) {
  let text = read(file);
  text = text.replace('import { requireMasterDataManager } from "@/lib/master-data-server";', 'import { requirePolicyEditor } from "@/lib/policy-access-server";');
  text = text.replaceAll('await requireMasterDataManager();', 'await requirePolicyEditor();');
  write(file, text);
}
for (const file of [
  "apps/web-portal/app/vehicles/new/page.tsx",
  "apps/web-portal/app/vehicles/[id]/edit/page.tsx",
]) {
  let text = read(file);
  text = text.replace('import { requireMasterDataManager } from "@/lib/master-data-server";', 'import { requireCapability } from "@/lib/master-data-server";');
  text = text.replaceAll('await requireMasterDataManager();', 'await requireCapability("view_vehicles", "edit");');
  write(file, text);
}

// Settings and permission administration are system-critical workflows.
{
  const file = "apps/web-portal/app/settings/page.tsx";
  effective(file);
  let text = read(file);
  text = text.replace('await requireMasterDataManager();', 'await requireCapability("manage_system", "approve");');
  text = text.replace('const canManagePermissions = Boolean(profile?.role && ["it_super_user", "super_admin"].includes(profile.role));', 'const canManagePermissions = await hasEffectiveCapability(profile, "manage_system", "approve");');
  write(file, text);
}
for (const file of [
  "apps/web-portal/app/system/access-control/page.tsx",
  "apps/web-portal/app/system/access-control/employees/[id]/page.tsx",
  "apps/web-portal/app/system/access-control/actions.ts",
]) {
  effective(file);
  replace(file, /!viewer\?\.id \|\| !\["it_super_user", "super_admin"\]\.includes\(viewer\.role \?\? ""\)/g, '!viewer?.id || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))');
  replace(file, /!profile\?\.id \|\| !editableRoles\.has\(profile\.role \?\? ""\)/g, '!profile?.id || !(await hasEffectiveCapability(profile, "manage_system", "approve"))');
}

// KYC and customer application review use KYC/customer permissions.
for (const file of [
  "apps/web-portal/app/customer-kyc/page.tsx",
  "apps/web-portal/app/customers/applications/page.tsx",
]) {
  let text = read(file);
  text = text.replace('import { requireMasterDataManager } from "@/lib/master-data-server";', 'import { requireCapability } from "@/lib/master-data-server";');
  text = text.replaceAll('await requireMasterDataManager();', 'await requireCapability("review_kyc", "edit");');
  write(file, text);
}
for (const file of [
  "apps/web-portal/app/customers/applications/actions.ts",
  "apps/web-portal/app/customers/applications/corporate-actions.ts",
  "apps/web-portal/app/customers/applications/dealership-actions.ts",
  "apps/web-portal/app/customers/applications/group-actions.ts",
]) {
  let text = read(file);
  text = text.replace('import { requireMasterDataManager } from "@/lib/master-data-server";', 'import { requireCapability } from "@/lib/master-data-server";');
  text = text.replaceAll('await requireMasterDataManager()', 'await requireCapability("review_kyc", "edit")');
  write(file, text);
}
for (const file of [
  "apps/web-portal/app/customers/dealership-type/page.tsx",
  "apps/web-portal/app/customers/groups/[id]/members/page.tsx",
  "apps/web-portal/app/customers/groups/[id]/members/actions.ts",
]) {
  let text = read(file);
  text = text.replace('import { requireMasterDataManager } from "@/lib/master-data-server";', 'import { requireCapability } from "@/lib/master-data-server";');
  text = text.replaceAll('await requireMasterDataManager()', 'await requireCapability("manage_customers", "edit")');
  text = text.replaceAll('await requireMasterDataManager();', 'await requireCapability("manage_customers", "edit");');
  write(file, text);
}

console.log("Effective permission migration applied.");
