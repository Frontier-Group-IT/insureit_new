import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateEmployeePortalGovernanceGuard } from "../lib/employee-portal-governance-rules.ts";

function fail(message) {
  throw new Error(`[employee-portal-governance] ${message}`);
}

function expect(name, input, expectedAllowed, expectedReasonFragment) {
  const result = evaluateEmployeePortalGovernanceGuard(input);
  if (result.allowed !== expectedAllowed) {
    fail(`${name}: expected allowed=${expectedAllowed}, got ${result.allowed}`);
  }
  if (!result.allowed && expectedReasonFragment && !result.reason.includes(expectedReasonFragment)) {
    fail(`${name}: expected reason containing "${expectedReasonFragment}", got "${result.reason}"`);
  }
}

const base = {
  actorProfileId: "actor-admin",
  actorRole: "admin",
};

expect(
  "employee manager may change employee-only HR status",
  { ...base, actorRole: "manager", operation: "suspend", targetProfileId: null },
  true,
);

expect(
  "non portal manager cannot suspend linked portal account",
  { ...base, actorRole: "manager", operation: "suspend", targetProfileId: "target-user", targetRole: "sales_manager" },
  false,
  "permission to manage employee portal access",
);

expect(
  "non portal manager cannot restore linked portal account",
  { ...base, actorRole: "sales_head", operation: "restore", targetProfileId: "target-user", targetRole: "relationship_manager" },
  false,
  "permission to manage employee portal access",
);

expect(
  "portal manager cannot suspend self",
  { ...base, actorProfileId: "same-user", operation: "suspend", targetProfileId: "same-user", targetRole: "admin" },
  false,
  "cannot suspend your own portal access",
);

expect(
  "final super admin cannot be suspended",
  { ...base, actorRole: "it_super_user", operation: "suspend", targetProfileId: "target-sa", targetRole: "super_admin", activeTargetRoleCount: 1 },
  false,
  "final active Super Admin",
);

expect(
  "final IT super user cannot be suspended",
  { ...base, actorRole: "super_admin", operation: "suspend", targetProfileId: "target-it", targetRole: "it_super_user", activeTargetRoleCount: 1 },
  false,
  "final active IT Super User",
);

expect(
  "one of multiple super admins may be suspended",
  { ...base, actorRole: "it_super_user", operation: "suspend", targetProfileId: "target-sa", targetRole: "super_admin", activeTargetRoleCount: 2 },
  true,
);

expect(
  "admin cannot create super admin",
  { ...base, operation: "invite", assigningRole: "super_admin", targetHasExistingProfile: false },
  false,
  "Only a Super Admin or IT Super User",
);

expect(
  "super admin may create super admin",
  { ...base, actorRole: "super_admin", operation: "invite", assigningRole: "super_admin", targetHasExistingProfile: false },
  true,
);

expect(
  "normal user management cannot create IT super user",
  { ...base, actorRole: "super_admin", operation: "invite", assigningRole: "it_super_user", targetHasExistingProfile: false },
  false,
  "protected technical role",
);

expect(
  "existing IT super user may be reinvited by IT administrator",
  { ...base, actorRole: "it_super_user", operation: "invite", assigningRole: "it_super_user", targetHasExistingProfile: true, targetProfileId: "target-it", targetRole: "it_super_user" },
  true,
);

expect(
  "admin may invite ordinary staff role",
  { ...base, operation: "invite", assigningRole: "relationship_manager", targetHasExistingProfile: false },
  true,
);

expect(
  "admin may invite Accounts role",
  { ...base, operation: "invite", assigningRole: "accounts", targetHasExistingProfile: false },
  true,
);

const governanceSource = readFileSync(
  resolve(process.cwd(), "lib/employee-portal-governance.ts"),
  "utf8",
);
const migrationSource = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20260916122000_add_accounts_app_role_and_quarantine_stranded_invites.sql"),
  "utf8",
);

if (!governanceSource.includes('requestedRole !== "accounts"')) {
  fail("Accounts orphan recovery must remain narrowly scoped to Accounts requests");
}
if (!governanceSource.includes('.is("employee_id", null)')) {
  fail("Accounts orphan recovery must require an unlinked profile");
}
if (!governanceSource.includes('app_role: input.portalRole')) {
  fail("portal role must be synchronized into server-controlled Auth app_metadata");
}
if (!governanceSource.includes("deleteUserOnFailure")) {
  fail("new Auth invitations must retain compensating cleanup on synchronization failure");
}
const authMetadataSyncIndex = governanceSource.indexOf("admin.auth.admin.updateUserById");
const profileUpsertIndex = governanceSource.indexOf('.from("profiles").upsert');
if (authMetadataSyncIndex < 0 || profileUpsertIndex < 0 || authMetadataSyncIndex > profileUpsertIndex) {
  fail("Auth app_metadata must be synchronized before the final profile upsert");
}
if (!migrationSource.includes("alter type public.app_role add value if not exists 'accounts'")) {
  fail("Accounts database enum migration is missing");
}
if (!migrationSource.includes("p.employee_id is null") || !migrationSource.includes("raw_user_meta_data ->> 'app_role'")) {
  fail("stranded Accounts invite quarantine must stay narrowly bounded");
}

console.log(JSON.stringify({
  governanceCases: 13,
  protectedRoles: ["super_admin", "it_super_user"],
  normalPortalManagerRoles: ["super_admin", "admin", "it_super_user"],
  accountsInviteRecovery: "guarded",
  accountsDatabaseRoleMigration: "present",
  status: "ok",
}, null, 2));
