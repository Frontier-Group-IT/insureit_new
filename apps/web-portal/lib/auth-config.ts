import { isIntermediaryRole, isPortalRole } from "./roles";

export const allowedAdminRoles = ["super_admin", "admin", "manager", "claim_processor", "field_executive"] as const;
export type AllowedAdminRole = (typeof allowedAdminRoles)[number];

export const accessTokenCookie = "insureit-access-token";
export const refreshTokenCookie = "insureit-refresh-token";
export const sessionRoleCookie = "insureit-session-role";

// Customer Web has an independent authenticated session on the same origin.
// Do not rename the existing Operations/Partner cookies: preserve their sessions.
export const customerAccessTokenCookie = "insureit-customer-access-token";
export const customerRefreshTokenCookie = "insureit-customer-refresh-token";
export const customerSessionRoleCookie = "insureit-customer-session-role";

export type Profile = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

export function isAllowedAdminRole(role: string | null | undefined): boolean {
  return Boolean(role && (allowedAdminRoles.includes(role as AllowedAdminRole) || isPortalRole(role) || isIntermediaryRole(role)));
}

export function isAuthorizedProfile(profile: Profile | null) {
  return Boolean(profile?.is_active && isAllowedAdminRole(profile.role));
}
