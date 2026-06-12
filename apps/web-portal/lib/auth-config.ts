import { isPortalRole } from "./roles";

export const allowedAdminRoles = ["super_admin", "admin", "manager", "claim_processor", "field_executive"] as const;
export type AllowedAdminRole = (typeof allowedAdminRoles)[number];

export const accessTokenCookie = "insureit-access-token";
export const refreshTokenCookie = "insureit-refresh-token";

export type Profile = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

export function isAllowedAdminRole(role: string | null | undefined): role is AllowedAdminRole {
  return Boolean(role && (allowedAdminRoles.includes(role as AllowedAdminRole) || isPortalRole(role)));
}

export function isAuthorizedProfile(profile: Profile | null) {
  return Boolean(profile?.is_active && isAllowedAdminRole(profile.role));
}
