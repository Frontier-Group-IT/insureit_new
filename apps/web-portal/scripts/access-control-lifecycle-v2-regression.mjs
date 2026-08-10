import { classifyPortalLifecycleV2 } from "../lib/access-control-portal-lifecycle-v2.ts";

function fail(message) {
  throw new Error(`[access-control-lifecycle-v2] ${message}`);
}

function expect(name, facts, expectedState, expectedUsable, expectedReview = false) {
  const decision = classifyPortalLifecycleV2({ now: new Date("2026-08-10T08:00:00.000Z"), ...facts });
  if (decision.state !== expectedState) fail(`${name}: expected state ${expectedState}, got ${decision.state}`);
  if (decision.portalUsable !== expectedUsable) fail(`${name}: expected portalUsable=${expectedUsable}, got ${decision.portalUsable}`);
  if (decision.requiresReview !== expectedReview) fail(`${name}: expected requiresReview=${expectedReview}, got ${decision.requiresReview}`);
}

expect(
  "active employee without access",
  { employeeExists: true, employmentStatus: "active", profileExists: false, authExists: false },
  "no_access",
  false,
);

expect(
  "invited employee",
  { employeeExists: true, employmentStatus: "active", profileExists: true, profileActive: true, authExists: true },
  "invited",
  false,
);

expect(
  "active portal user",
  {
    employeeExists: true,
    employmentStatus: "active",
    profileExists: true,
    profileActive: true,
    authExists: true,
    emailConfirmedAt: "2026-08-09T08:00:00.000Z",
    lastSignInAt: "2026-08-10T07:00:00.000Z",
  },
  "active",
  true,
);

expect(
  "disabled profile",
  {
    employeeExists: true,
    employmentStatus: "active",
    profileExists: true,
    profileActive: false,
    authExists: true,
    emailConfirmedAt: "2026-08-09T08:00:00.000Z",
  },
  "disabled",
  false,
);

expect(
  "temporarily suspended auth user",
  {
    employeeExists: true,
    employmentStatus: "active",
    profileExists: true,
    profileActive: true,
    authExists: true,
    emailConfirmedAt: "2026-08-09T08:00:00.000Z",
    bannedUntil: "2026-08-11T08:00:00.000Z",
  },
  "suspended",
  false,
);

expect(
  "expired auth suspension returns active",
  {
    employeeExists: true,
    employmentStatus: "active",
    profileExists: true,
    profileActive: true,
    authExists: true,
    emailConfirmedAt: "2026-08-09T08:00:00.000Z",
    bannedUntil: "2026-08-10T07:59:59.000Z",
  },
  "active",
  true,
);

expect(
  "inactive employee identity needs review",
  {
    employeeExists: true,
    employmentStatus: "inactive",
    profileExists: true,
    profileActive: true,
    authExists: true,
    emailConfirmedAt: "2026-08-09T08:00:00.000Z",
  },
  "former_employee",
  false,
  true,
);

expect(
  "profile without auth",
  { employeeExists: true, employmentStatus: "active", profileExists: true, profileActive: true, authExists: false },
  "profile_without_auth",
  false,
  true,
);

expect(
  "auth without profile",
  { employeeExists: true, employmentStatus: "active", profileExists: false, authExists: true },
  "auth_without_profile",
  false,
  true,
);

expect(
  "identity without employee",
  { employeeExists: false, profileExists: true, profileActive: true, authExists: true },
  "orphan_identity",
  false,
  true,
);

console.log(JSON.stringify({
  lifecycleCases: 10,
  mutationMode: "shadow-read-model-only",
  status: "ok",
}, null, 2));
