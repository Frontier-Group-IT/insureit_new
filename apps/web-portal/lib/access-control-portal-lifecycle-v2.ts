export type PortalLifecycleStateV2 =
  | "no_access"
  | "invited"
  | "active"
  | "suspended"
  | "disabled"
  | "former_employee"
  | "profile_without_auth"
  | "auth_without_profile"
  | "orphan_identity";

export type PortalLifecycleFactsV2 = {
  employeeExists: boolean;
  employmentStatus?: string | null;
  profileExists: boolean;
  profileActive?: boolean | null;
  authExists: boolean;
  emailConfirmedAt?: string | Date | null;
  lastSignInAt?: string | Date | null;
  bannedUntil?: string | Date | null;
  now?: Date;
};

export type PortalLifecycleDecisionV2 = {
  state: PortalLifecycleStateV2;
  portalUsable: boolean;
  requiresReview: boolean;
  reason: string;
};

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function employeeIsActive(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase() === "active";
}

/**
 * Shadow-only lifecycle classifier. It does not query Supabase Auth and does
 * not mutate employees, profiles or auth users. Callers provide observed facts.
 */
export function classifyPortalLifecycleV2(facts: PortalLifecycleFactsV2): PortalLifecycleDecisionV2 {
  const now = facts.now ?? new Date();

  if (!facts.employeeExists) {
    if (facts.profileExists || facts.authExists) {
      return {
        state: "orphan_identity",
        portalUsable: false,
        requiresReview: true,
        reason: "Portal/Auth identity exists without a linked employee record.",
      };
    }
    return {
      state: "no_access",
      portalUsable: false,
      requiresReview: false,
      reason: "No employee or portal identity exists.",
    };
  }

  if (!employeeIsActive(facts.employmentStatus)) {
    return {
      state: "former_employee",
      portalUsable: false,
      requiresReview: Boolean((facts.profileExists && facts.profileActive !== false) || facts.authExists),
      reason: "Employee is not active; portal access must remain unusable.",
    };
  }

  if (!facts.profileExists && !facts.authExists) {
    return {
      state: "no_access",
      portalUsable: false,
      requiresReview: false,
      reason: "Active employee has no portal profile or Auth identity.",
    };
  }

  if (facts.profileExists && !facts.authExists) {
    return {
      state: "profile_without_auth",
      portalUsable: false,
      requiresReview: true,
      reason: "Employee profile exists but the matching Auth identity is missing.",
    };
  }

  if (!facts.profileExists && facts.authExists) {
    return {
      state: "auth_without_profile",
      portalUsable: false,
      requiresReview: true,
      reason: "Auth identity exists but the linked employee portal profile is missing.",
    };
  }

  if (facts.profileActive === false) {
    return {
      state: "disabled",
      portalUsable: false,
      requiresReview: false,
      reason: "Portal profile is disabled.",
    };
  }

  const bannedUntil = asDate(facts.bannedUntil);
  if (bannedUntil && bannedUntil.getTime() > now.getTime()) {
    return {
      state: "suspended",
      portalUsable: false,
      requiresReview: false,
      reason: "Auth identity is temporarily suspended or banned.",
    };
  }

  const confirmedAt = asDate(facts.emailConfirmedAt);
  const lastSignInAt = asDate(facts.lastSignInAt);
  if (!confirmedAt && !lastSignInAt) {
    return {
      state: "invited",
      portalUsable: false,
      requiresReview: false,
      reason: "Portal invitation exists but the user has not completed first access.",
    };
  }

  return {
    state: "active",
    portalUsable: true,
    requiresReview: false,
    reason: "Employee, portal profile and Auth identity are active.",
  };
}
