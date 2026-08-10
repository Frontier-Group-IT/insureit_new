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

console.log(JSON.stringify({
  governanceCases: 12,
  protectedRoles: ["super_admin", "it_super_user"],
  normalPortalManagerRoles: ["super_admin", "admin", "it_super_user"],
  status: "ok",
}, null, 2));
